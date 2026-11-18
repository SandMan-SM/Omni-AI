"""Read recent public editorial material from the channels' own sites."""

from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, time, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
import re
from urllib.error import URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo


MOUNTAIN = ZoneInfo("America/Denver")
SUCCESS_FEEDS = (
    "https://mafiempire.com/newsletter/feed.xml",
    "https://sitanimafi.com/newsletter/rss.xml",
)
AIS_NEWSLETTER = "https://aisempire.org/newsletter"
ARTICLE_PATH = re.compile(r"/newsletter/(?:daily/|principles/)?[a-z0-9-]+/?\Z")
WORKFLOW_TERMS = re.compile(
    r"\b(automate|automation|workflow|pilot|document check|review queue|business owner|"
    r"ai employe|lead routing|human review|ai-assisted work|operations)\w*", re.I
)
APPLIED_AI_TERMS = re.compile(r"\b(ai|agentic|automat\w*|workflow\w*)\b", re.I)
BLOCKED_AIS_SECTIONS = {"legacy branding", "crypto & security", "news"}
FETCH_BYTES = 600_000
FETCH_TIMEOUT = 4


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


class NewsletterHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.meta = {}

    def handle_starttag(self, tag, attrs):
        fields = dict(attrs)
        if tag == "a" and fields.get("href"):
            self.links.append(fields["href"])
        if tag == "meta" and fields.get("property") and fields.get("content"):
            self.meta.setdefault(fields["property"], fields["content"])


def read_public(url):
    """Fetch only allowlisted pages and decline all redirects."""
    if url not in (*SUCCESS_FEEDS, AIS_NEWSLETTER) and article_url(url, "aisempire.org") != url:
        return None
    try:
        request = Request(url, headers={"User-Agent": "OmniAI-Editorial/1.0"})
        with build_opener(NoRedirects).open(request, timeout=FETCH_TIMEOUT) as response:
            payload = response.read(FETCH_BYTES + 1)
            return payload if len(payload) <= FETCH_BYTES else None
    except (URLError, OSError, ValueError):
        return None


def article_url(url, domain):
    try:
        parts = urlsplit(url)
        if parts.scheme == "https" and parts.netloc == domain and ARTICLE_PATH.fullmatch(parts.path):
            return f"https://{domain}{parts.path.rstrip('/')}"
    except ValueError:
        return None
    return None


def clean_text(value):
    return " ".join(unescape(re.sub(r"<[^>]*>", " ", value)).split())


def recent(publication, day, now):
    return day - timedelta(days=3) <= publication.astimezone(MOUNTAIN).date() <= day and publication <= now


def article(title, summary, url, published_at, family):
    title = clean_text(title)
    if not title or len(title) > 220:
        return None
    summary = clean_text(summary).split("Explore this story and join the legacy", 1)[0].strip()
    if len(summary) > 400 or re.search(r"https?://", summary, re.I):
        summary = ""
    slug = url.rsplit("/", 1)[-1]
    slug = re.sub(r"^(?:daily-letter|principle)-\d{4}-\d{2}-\d{2}-", "", slug)
    post = {"category": "article", "text": f"{title}\n\n{summary}" if summary else title,
            "url": url, "source_key": f"{family}:{slug}"}
    return published_at, post


def from_feed(source, day, now):
    payload = read_public(source)
    if not payload or re.search(br"<!\s*(?:DOCTYPE|ENTITY)", payload, re.I) or b"\x00" in payload:
        return []
    try:
        items = ET.fromstring(payload).findall("./channel/item")
    except ET.ParseError:
        return []
    posts = []
    for item in items[:100]:
        try:
            published = parsedate_to_datetime(item.findtext("pubDate", ""))
            if published.tzinfo is None or not recent(published, day, now):
                continue
        except (ValueError, TypeError, OverflowError):
            continue
        url = article_url(item.findtext("link", "").strip(), urlsplit(source).netloc)
        if not url:
            continue
        post = article(item.findtext("title", ""), item.findtext("description", ""), url,
                       published, "success-empire")
        if post:
            posts.append(post)
    return posts


def from_ais_article(url, day, now):
    payload = read_public(url)
    if not payload:
        return None
    page = NewsletterHTML()
    page.feed(payload.decode("utf-8", errors="replace"))
    publication = page.meta.get("article:published_time", "")
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", publication):
            published = datetime.combine(date.fromisoformat(publication), time.min, tzinfo=MOUNTAIN)
        else:
            published = datetime.fromisoformat(publication)
            if published.tzinfo is None:
                return None
        if not recent(published, day, now):
            return None
    except (ValueError, OverflowError):
        return None
    title, summary = (page.meta.get(field, "") for field in ("og:title", "og:description"))
    body = f"{title} {summary}"
    if page.meta.get("article:section", "").lower() in BLOCKED_AIS_SECTIONS:
        return None
    if WORKFLOW_TERMS.search(body) and APPLIED_AI_TERMS.search(body):
        return article(title, summary, url, published, "interlinked")
    return None


def from_ais_newsletter(day, now):
    payload = read_public(AIS_NEWSLETTER)
    if not payload:
        return []
    listing = NewsletterHTML()
    listing.feed(payload.decode("utf-8", errors="replace"))
    links = dict.fromkeys(article_url(urljoin(AIS_NEWSLETTER, href), "aisempire.org") for href in listing.links)
    links.pop(None, None)
    with ThreadPoolExecutor(max_workers=4) as executor:
        return [post for post in executor.map(lambda url: from_ais_article(url, day, now), list(links)[:12]) if post]


def fresh_posts(channel: str, day: date) -> list[dict]:
    """Return newest-first candidates bearing a verified recent publication date."""
    now = datetime.now(timezone.utc)
    posts = []
    if channel == "success-empire":
        for feed in SUCCESS_FEEDS:
            posts.extend(from_feed(feed, day, now))
    if channel == "interlinked":
        posts = from_ais_newsletter(day, now)
    unique = {}
    for _, post in sorted(posts, key=lambda entry: entry[0], reverse=True):
        unique.setdefault(post["source_key"], post)
    return list(unique.values())

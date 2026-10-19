// Retired portfolio sponsor embed. Keep this URL available for older sites
// and third-party code injections so their existing mounts disappear safely.
// The retired embed does not select creatives, send events, or contact APIs.

import { NextResponse } from "next/server";

const SCRIPT = /* js */ `(function(){
  function retireMounts() {
    document.querySelectorAll('[id="omni-sponsor"], [data-omni-sponsor]').forEach(function(host){
      host.hidden = true;
      host.style.setProperty("display", "none", "important");
      if (host.firstChild) host.textContent = "";
    });
  }

  retireMounts();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", retireMounts, { once: true });
  }
  if (typeof MutationObserver === "function") {
    new MutationObserver(retireMounts).observe(document.documentElement, { childList: true, subtree: true });
  }
})();`;

export async function GET() {
  return new NextResponse(SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const dynamic = "force-dynamic";

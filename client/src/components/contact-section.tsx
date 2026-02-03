import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertWaitlistSchema, type InsertWaitlistEntry } from "@shared/schema";

interface ContactSectionProps {
  preselectedTier?: string;
}

export function ContactSection({ preselectedTier }: ContactSectionProps) {
  const { toast } = useToast();

  const form = useForm<InsertWaitlistEntry>({
    resolver: zodResolver(insertWaitlistSchema),
    defaultValues: {
      name: "",
      email: "",
      businessUrl: "",
      tierInterest: (preselectedTier as InsertWaitlistEntry["tierInterest"]) || "peasant",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertWaitlistEntry) => {
      const response = await apiRequest("POST", "/api/waitlist", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "You're on the list",
        description: "We'll be in touch soon. Prepare for ascension.",
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertWaitlistEntry) => {
    mutation.mutate(data);
  };

  return (
    <section className="relative py-32 px-4" id="contact">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-purple-500/10 blur-[150px]" />
      </div>

      <div className="max-w-xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">Join the Waitlist</span>
          </h2>
          <p className="text-gray-400 text-lg">
            Ready to transcend the ordinary? Enter your details below.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <div className="glass-card rounded-md p-8 neon-border">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Your name"
                          className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500"
                          data-testid="input-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500"
                          data-testid="input-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">
                        Business URL (optional)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://yourbusiness.com"
                          className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500"
                          data-testid="input-business-url"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tierInterest"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">
                        Tier Interest
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger
                            className="bg-white/5 border-white/10 text-white"
                            data-testid="select-tier"
                          >
                            <SelectValue placeholder="Select a tier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-gray-900 border-white/10">
                          <SelectItem value="peasant" data-testid="select-tier-peasant">
                            Tier 0 — Peasant (Free)
                          </SelectItem>
                          <SelectItem value="knight" data-testid="select-tier-knight">
                            Tier 1 — Knight ($1,000/mo)
                          </SelectItem>
                          <SelectItem value="royal" data-testid="select-tier-royal">
                            Tier 2 — Royal ($3k–$5k/mo)
                          </SelectItem>
                          <SelectItem value="ascended" data-testid="select-tier-ascended">
                            Tier 3 — Ascended ($10k–$25k/mo)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white py-6 rounded-md neon-glow"
                  data-testid="button-submit-waitlist"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      Join the Waitlist
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

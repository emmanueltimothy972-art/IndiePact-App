import { PageTransition } from "@/components/PageTransition";
import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SCENARIOS = [
  { id: "revision", label: "Disputing a revision clause", starter: "Good afternoon. I've reviewed the contract. Our standard terms include unlimited revisions until client satisfaction. This is non-negotiable. How would you like to proceed?" },
  { id: "payment", label: "Pushing back on net-90 payment", starter: "Our accounts payable cycle runs on net-90. All vendors operate on these terms. We don't make exceptions." },
  { id: "ip", label: "Protecting IP ownership", starter: "All work produced for our company becomes company property upon delivery. This is standard practice in our industry." },
  { id: "termination", label: "Challenging termination without cause", starter: "We reserve the right to terminate any vendor agreement at any time. This protects our operational flexibility." }
];

type Message = {
  role: "user" | "ai";
  content: string;
};

export default function ShadowNegotiator() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scenario = SCENARIOS.find(s => s.id === scenarioId);
    if (scenario) {
      setMessages([{ role: "ai", content: scenario.starter }]);
    }
  }, [scenarioId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const scenarioLabel = SCENARIOS.find(s => s.id === scenarioId)?.label || "";
      const history = messages.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, scenario: scenarioLabel, history })
      });

      if (!res.ok) throw new Error("API failed");
      const data = await res.json();
      
      setMessages(prev => [...prev, { role: "ai", content: data.reply || "I need to review this with my team." }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "ai", content: "The AI is currently unavailable. Please try again shortly." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition className="space-y-6 max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <MessageSquare className="text-primary h-8 w-8" />
            Shadow Negotiator
          </h1>
          <p className="text-muted-foreground mt-2">Rehearse your negotiation. The AI plays the other side.</p>
        </div>
        <Select value={scenarioId} onValueChange={setScenarioId}>
          <SelectTrigger className="w-[280px] bg-card">
            <SelectValue placeholder="Select Scenario" />
          </SelectTrigger>
          <SelectContent>
            {SCENARIOS.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 border border-border rounded-xl bg-card flex flex-col overflow-hidden relative">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                msg.role === "user" 
                  ? "bg-primary text-primary-foreground rounded-tr-sm" 
                  : "bg-muted text-foreground border border-border rounded-tl-sm"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted border border-border rounded-2xl rounded-tl-sm px-5 py-4 flex gap-1 items-center h-[52px]">
                <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-background border-t border-border shrink-0">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }} 
            className="flex items-center gap-3 relative"
          >
            <Input 
              placeholder="Type your response..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-card border-border pr-12 h-12 rounded-full"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-1.5 h-9 w-9 rounded-full" 
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </PageTransition>
  );
}
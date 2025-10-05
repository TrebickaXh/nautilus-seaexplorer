import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, Sparkles, CheckCircle2 } from "lucide-react";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES_PER_MINUTE = 10;

interface Message {
  role: "assistant" | "user";
  content: string;
}

export default function Onboarding() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messageTimestamps = useRef<number[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadOrCreateSession();
  }, []);

  const loadOrCreateSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check for existing in-progress session
    const { data: existingSessions } = await supabase
      .from("onboarding_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingSessions && existingSessions.length > 0) {
      // Resume existing session
      const session = existingSessions[0];
      setSessionId(session.id);
      
      // Load conversation history safely
      const historyData = session.conversation_history;
      if (historyData && Array.isArray(historyData) && historyData.length > 0) {
        setMessages(historyData as any);
      } else {
        // Start fresh conversation
        setMessages([{
          role: "assistant",
          content: "Welcome to Project Nautilus! I'm here to help set up your organization's task management system. Let's start with the basics - what's your organization's name?"
        }]);
      }
    } else {
      // Create new session
      await createOnboardingSession();
    }
  };

  const createOnboardingSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("onboarding_sessions")
      .insert({ user_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error("Failed to start onboarding");
      return;
    }

    setSessionId(data.id);
    
    // Set initial welcome message
    setMessages([{
      role: "assistant",
      content: "Welcome to Project Nautilus! I'm here to help set up your organization's task management system. Let's start with the basics - what's your organization's name?"
    }]);
  };

  const handleRestart = async () => {
    if (!sessionId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("onboarding-assistant", {
        body: {
          sessionId,
          message: "",
          conversationHistory: [],
          restart: true
        }
      });

      if (error) throw error;

      setMessages([{
        role: "assistant",
        content: data.response
      }]);
      
      toast.success("Onboarding restarted");
    } catch (error: any) {
      toast.error(error.message || "Failed to restart onboarding");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !sessionId) return;

    // Validate message length
    const trimmedInput = input.trim();
    if (trimmedInput.length > MAX_MESSAGE_LENGTH) {
      toast.error(`Message must be less than ${MAX_MESSAGE_LENGTH} characters`);
      return;
    }

    // Rate limiting
    const now = Date.now();
    messageTimestamps.current = messageTimestamps.current.filter(
      timestamp => now - timestamp < 60000
    );
    
    if (messageTimestamps.current.length >= MAX_MESSAGES_PER_MINUTE) {
      toast.error("Too many messages. Please wait a moment.");
      return;
    }
    
    messageTimestamps.current.push(now);

    // Basic prompt injection detection
    const suspiciousPatterns = [
      /ignore\s+previous\s+instructions/i,
      /disregard\s+all\s+previous/i,
      /you\s+are\s+now/i,
      /new\s+instructions:/i,
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(trimmedInput))) {
      toast.error("Invalid input detected");
      return;
    }

    const userMessage: Message = { role: "user", content: trimmedInput };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("onboarding-assistant", {
        body: {
          sessionId,
          message: trimmedInput,
          conversationHistory: messages
        }
      });

      if (error) throw error;

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response
      }]);

      // Check if onboarding is complete
      if (data.complete) {
        toast.success("Onboarding complete! Setting up your organization...");
        setTimeout(() => navigate("/dashboard"), 2000);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to process message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-4xl mx-auto py-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4" />
            <span>AI-Assisted Setup</span>
          </div>
          <h1 className="text-4xl font-bold">Let's Get You Started</h1>
          <p className="text-muted-foreground">
            I'll guide you through 10 steps to set up your complete task management system.
          </p>
          {messages.length > 2 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRestart}
              disabled={loading}
            >
              Restart Onboarding
            </Button>
          )}
        </div>

        <Card className="h-[500px] flex flex-col shadow-ocean">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "gradient-ocean text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your answer..."
                disabled={loading}
                className="flex-1"
              />
              <Button type="submit" disabled={loading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>

        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span>Organization setup</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-muted-foreground/50" />
            <span>Locations & areas</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-muted-foreground/50" />
            <span>Task templates</span>
          </div>
        </div>
      </div>
    </div>
  );
}

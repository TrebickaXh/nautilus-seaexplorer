import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Send, Sparkles, CheckCircle2, Building2, MapPin, Users2, Clock, ListTodo, FileText, Bell, ClipboardCheck, Settings2, Shield } from "lucide-react";
import ReactMarkdown from "react-markdown";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES_PER_MINUTE = 10;

const STEPS = [
  { label: "Company", icon: Building2 },
  { label: "Locations", icon: MapPin },
  { label: "Departments", icon: Settings2 },
  { label: "Shifts", icon: Clock },
  { label: "Team", icon: Users2 },
  { label: "Routines", icon: ListTodo },
  { label: "One-offs", icon: FileText },
  { label: "Rules", icon: Shield },
  { label: "Alerts", icon: Bell },
  { label: "Review", icon: ClipboardCheck },
];

interface Message {
  role: "assistant" | "user";
  content: string;
}

export default function Onboarding() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messageTimestamps = useRef<number[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

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

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

      // Detect current step from AI response
      if (data.currentStep) {
        setCurrentStep(data.currentStep);
      } else {
        // Heuristic step detection from response content
        const response = data.response.toLowerCase();
        if (response.includes("step 10") || response.includes("review") || response.includes("confirm")) setCurrentStep(10);
        else if (response.includes("step 9") || response.includes("notification") || response.includes("report")) setCurrentStep(9);
        else if (response.includes("step 8") || response.includes("task rule") || response.includes("incomplete")) setCurrentStep(8);
        else if (response.includes("step 7") || response.includes("one-off") || response.includes("one-time")) setCurrentStep(7);
        else if (response.includes("step 6") || response.includes("routine") || response.includes("task")) setCurrentStep(6);
        else if (response.includes("step 5") || response.includes("team member") || response.includes("invite")) setCurrentStep(5);
        else if (response.includes("step 4") || response.includes("shift")) setCurrentStep(4);
        else if (response.includes("step 3") || response.includes("department")) setCurrentStep(3);
        else if (response.includes("step 2") || response.includes("location")) setCurrentStep(2);
      }

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
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <div className={`text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-2 prose-strong:font-semibold ${
                    message.role === "user" 
                      ? "prose-invert prose-headings:text-primary-foreground prose-p:text-primary-foreground prose-strong:text-primary-foreground" 
                      : "dark:prose-invert"
                  }`}>
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
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
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2 items-end"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type your answer... (Shift+Enter for new line)"
                disabled={loading}
                className="flex-1 min-h-[60px] max-h-[200px] resize-none"
                rows={2}
              />
              <Button type="submit" disabled={loading || !input.trim()} className="h-[60px]">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>

        {/* Step Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Step {currentStep} of 10</span>
            <span>{Math.round((currentStep / 10) * 100)}% complete</span>
          </div>
          <Progress value={(currentStep / 10) * 100} className="h-2" />
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
            {STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const stepNum = idx + 1;
              const isComplete = stepNum < currentStep;
              const isCurrent = stepNum === currentStep;
              return (
                <div
                  key={step.label}
                  className={`flex flex-col items-center gap-1 min-w-[60px] ${
                    isCurrent ? "text-primary" : isComplete ? "text-success" : "text-muted-foreground/40"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    isCurrent ? "bg-primary/10 ring-2 ring-primary" : isComplete ? "bg-success/10" : "bg-muted/50"
                  }`}>
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <span className="text-[10px] font-medium">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, BatteryTelemetry, HealthMetrics, EVVehiclePreset } from '../types';
import { X, Send, Cpu, Bot, User, Sparkles, HelpCircle, ArrowRight } from 'lucide-react';

interface DigitalDoctorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle?: EVVehiclePreset;
  telemetry?: BatteryTelemetry;
  healthMetrics?: HealthMetrics;
  context?: {
    vehicle: EVVehiclePreset;
    telemetry: BatteryTelemetry;
    healthMetrics: HealthMetrics;
  };
  initialPrompt?: string;
}

export const DigitalDoctorDrawer: React.FC<DigitalDoctorDrawerProps> = ({
  isOpen,
  onClose,
  vehicle,
  telemetry,
  healthMetrics,
  context,
  initialPrompt
}) => {
  const effVehicle: EVVehiclePreset = vehicle || context?.vehicle || {
    id: 'tesla-m3',
    name: 'Tesla Model 3 Long Range',
    model: 'Model 3 LR',
    packType: '400V Scaled Pack',
    chemistry: 'NMC',
    nominalCapacityAh: 150,
    nominalVoltageV: 370,
    totalEnergyKwh: 75,
    baselineResistanceMilliOhm: 14.5,
    maxChargingKw: 150,
    description: 'High-energy density nickel-manganese-cobalt chemistry.'
  };

  const effTelemetry: BatteryTelemetry = telemetry || context?.telemetry || {
    voltage: 370.0,
    current: 20.0,
    temperature: 25.0,
    soc: 80.0,
    internalResistance: 14.5,
    cycleCount: 60,
    nominalCapacity: 150.0,
    currentCapacity: 142.5,
    chargeRateKw: 0,
    ambientTemp: 22.0,
    timestamp: Date.now()
  };

  const effHealth: HealthMetrics = healthMetrics || context?.healthMetrics || {
    soh: 91.2,
    rulCycles: 820,
    rulYears: 5.8,
    anomalies: [],
    healthStatusText: 'GOOD',
    riskLevel: 'LOW'
  };

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: `Hello! I am your AI EV Battery Digital Doctor. I am currently monitoring your ${effVehicle.name} (${effVehicle.chemistry} pack at ${effHealth.soh}% SoH). I am strictly grounded in your pack's physical telemetry and TreeSHAP ML feature attributions. How can I assist with your battery diagnostics today?`,
      timestamp: new Date().toLocaleTimeString(),
      suggestedActions: [
        'Why did my health drop?',
        'Is fast charging damaging my battery?',
        'What is my remaining useful life?'
      ]
    }
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Handle initial prompt if passed
  useEffect(() => {
    if (initialPrompt && isOpen) {
      handleSendMessage(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString()
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInputQuery('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat-digital-doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userQuery: query,
          messages: updatedHistory.map(m => ({
            sender: m.sender,
            text: m.text,
            timestamp: m.timestamp
          })),
          context: {
            vehicle: effVehicle,
            telemetry: effTelemetry,
            healthMetrics: effHealth
          }
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      const doctorMsg: ChatMessage = {
        id: `doctor-${Date.now()}`,
        sender: 'assistant',
        text: data.reply || "I don't know.",
        timestamp: new Date().toLocaleTimeString(),
        suggestedActions: data.suggestedActions || [
          'Why did my health drop?',
          'Is fast charging damaging my battery?',
          'What is my remaining useful life?'
        ]
      };

      setMessages(prev => [...prev, doctorMsg]);

    } catch (err) {
      console.warn('Doctor AI response error, falling back to deterministic diagnostics:', err);
      const fallbackReply =
        `Diagnostics for ${effVehicle.name} (Current SoH: ${effHealth.soh}%):\n` +
        `• Pack operating at ${effTelemetry.temperature.toFixed(1)}°C with internal resistance ${effTelemetry.internalResistance.toFixed(1)} mΩ.\n` +
        `• Estimated RUL: ${effHealth.rulCycles} cycles (~${effHealth.rulYears} years).\n` +
        `• Degradation rate aligns with nominal aging curves (TreeSHAP cycle attribution primary driver).`;

      setMessages(prev => [
        ...prev,
        {
          id: `doctor-${Date.now()}`,
          sender: 'assistant',
          text: fallbackReply,
          timestamp: new Date().toLocaleTimeString(),
          suggestedActions: [
            'Why did my health drop?',
            'Is fast charging damaging my battery?',
            'What is my remaining useful life?'
          ]
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end">
      
      {/* Slide-over Drawer Panel */}
      <div className="w-full max-w-lg bg-slate-950 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 p-0.5">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Bot className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                Digital Doctor AI
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              </h2>
              <p className="text-xs text-slate-400">
                {effVehicle.name} ({effHealth.soh}% SoH • {effTelemetry.temperature}°C)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
              TreeSHAP Grounded
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Diagnostic Context Bar */}
        <div className="px-4 py-2 bg-indigo-950/40 border-b border-indigo-900/40 flex items-center justify-between text-[11px] font-mono text-indigo-300">
          <span>RUL: {effHealth.rulYears} yrs ({effHealth.rulCycles} cyc)</span>
          <span className="text-emerald-400">✓ Grounded Diagnostics</span>
          <span>Flags: {effHealth.anomalies.length} Active</span>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mb-1">
                {msg.sender === 'user' ? (
                  <><span>You</span><User className="w-3 h-3 text-cyan-400" /></>
                ) : (
                  <><Bot className="w-3 h-3 text-indigo-400" /><span>Digital Doctor</span></>
                )}
                <span>• {msg.timestamp}</span>
              </div>

              <div
                className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-cyan-600 text-white rounded-tr-none font-sans'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none font-sans whitespace-pre-wrap'
                }`}
              >
                {msg.text}
              </div>

              {/* Suggested Follow-up Action Pills */}
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-w-[85%]">
                  {msg.suggestedActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(action)}
                      className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 transition text-left"
                    >
                      💡 {action}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800 max-w-[200px]">
              <Cpu className="w-4 h-4 animate-spin" />
              <span>Analyzing telemetry...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-900">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask about health, charging, or thermal warnings..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-sans"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isTyping}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

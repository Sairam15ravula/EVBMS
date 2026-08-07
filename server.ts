import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { VEHICLE_PRESETS, SCENARIO_PRESETS, generateLiveTelemetryFrame, generateDegradationCurve } from './src/data/batteryData';
import { calculateHealthMetrics } from './src/utils/analyticsEngine';
import { AIExplainResponse } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Initialize Gemini API client lazily / safely
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI | null {
    if (!aiClient) {
      const key = process.env.GEMINI_API_KEY;
      if (key && key !== 'MY_GEMINI_API_KEY') {
        aiClient = new GoogleGenAI({
          apiKey: key,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });
      }
    }
    return aiClient;
  }

  // API 1: Fetch Vehicle and Scenario Presets
  app.get('/api/presets', (req, res) => {
    res.json({
      vehicles: VEHICLE_PRESETS,
      scenarios: SCENARIO_PRESETS
    });
  });

  // API 2: Fetch Telemetry & Health Metrics
  app.post('/api/telemetry', (req, res) => {
    const { vehicleId = 'tesla-m3', scenarioId = 'healthy-new', timeStep = 0 } = req.body;

    const vehicle = VEHICLE_PRESETS.find(v => v.id === vehicleId) || VEHICLE_PRESETS[0];
    const scenario = SCENARIO_PRESETS.find(s => s.id === scenarioId) || SCENARIO_PRESETS[0];

    const telemetry = generateLiveTelemetryFrame(vehicle, scenario, Number(timeStep));
    const healthMetrics = calculateHealthMetrics(telemetry, vehicle);
    const degradationCurve = generateDegradationCurve(scenario.soh, scenario.initialCycle, vehicle.chemistry as 'NMC' | 'LFP');

    res.json({
      vehicle,
      scenario,
      telemetry,
      healthMetrics,
      degradationCurve
    });
  });

  // API 3: Explainable AI (XAI) - Explain Battery Degradation via Gemini
  app.post('/api/explain-degradation', async (req, res) => {
    try {
      const { vehicle, scenario, telemetry, healthMetrics } = req.body;

      const ai = getGeminiClient();
      if (!ai) {
        // Fallback structured response if key is missing or placeholder
        const fallbackResponse: AIExplainResponse = {
          summary: `The ${vehicle?.name || 'EV Pack'} is operating at ${healthMetrics?.soh || 91}% State of Health with ${healthMetrics?.anomalies?.length || 0} active diagnostic flags. Major degradation drivers include elevated thermal cycles and high-current fast charging.`,
          degradationCauses: [
            {
              factor: 'SEI Layer Growth & Solid Electrolyte Interphase Thickening',
              impactPercentage: 45,
              description: 'Continuous chemical breakdown at the graphite anode consuming active lithium ions during cycling.'
            },
            {
              factor: 'High C-Rate Thermal Stress from DC Fast Charging',
              impactPercentage: 35,
              description: 'Fast charging currents (150kW+) generate internal ohmic heat (I²R) that breaks down cathode material structure.'
            },
            {
              factor: 'Sub-Zero Operation & Mechanical Micro-cracking',
              impactPercentage: 20,
              description: 'Cold battery charge events create high internal impedance and localized lithium plating stress.'
            }
          ],
          healthDiagnosis: `Battery is in ${healthMetrics?.healthStatusText || 'GOOD'} condition. Estimated remaining useful life is ${healthMetrics?.rulYears || 6.2} years (${healthMetrics?.rulCycles || 980} cycles) before reaching the 80% EOL boundary.`,
          riskAssessment: {
            level: healthMetrics?.riskLevel || 'LOW',
            thermalRunawayRisk: telemetry?.temperature > 45 ? 'Elevated due to recent thermal peak' : 'Low under current passive cooling profile',
            lithiumPlatingRisk: telemetry?.temperature < 5 ? 'High during fast charging' : 'Minimal at standard operating temperatures',
            cellDegradationRisk: 'Moderate degradation rate consistent with NASA B0005 benchmark'
          },
          actionPlan: [
            'Maintain daily State of Charge (SoC) between 20% and 80% to minimize mechanical lattice stress.',
            'Activate battery pre-conditioning 15 minutes before plugging into DC Fast Chargers in winter.',
            'Allow 10-minute thermal soak/cooling period after long high-speed highway trips prior to high-power fast charging.'
          ],
          estimatedRemainingYears: healthMetrics?.rulYears || 6.2
        };
        return res.json({ success: true, aiAnalysis: fallbackResponse, source: 'simulated_fallback' });
      }

      const prompt = `Act as an expert EV Battery Engineering AI (Digital Doctor for Lithium-Ion & LFP Packs). 
Analyze the following EV telemetry and health metrics data based on NASA B0005 & CALCE battery research standards:

VEHICLE: ${vehicle.name} (${vehicle.model})
CHEMISTRY: ${vehicle.chemistry} (${vehicle.totalEnergyKwh} kWh Pack)
CURRENT METRICS:
- State of Health (SoH): ${healthMetrics.soh}%
- Nominal Capacity: ${telemetry.nominalCapacity} Ah
- Current Capacity: ${telemetry.currentCapacity} Ah
- Cycle Count: ${telemetry.cycleCount} cycles
- Remaining Useful Life (RUL): ${healthMetrics.rulCycles} cycles (${healthMetrics.rulYears} years)
- Temperature: ${telemetry.temperature}°C
- Voltage: ${telemetry.voltage} V
- Current: ${telemetry.current} A
- Internal Resistance: ${telemetry.internalResistance} mΩ
- Active Anomalies: ${JSON.stringify(healthMetrics.anomalies)}

Generate a structured XAI (Explainable AI) diagnosis JSON answering:
1. Concise executive summary of current battery health.
2. Top 3 physical degradation causes with calculated percentage contribution impact.
3. Plain-language health diagnosis for driver and technician.
4. Risk assessment breakdown for Thermal Runaway, Lithium Plating, and Cell Degradation.
5. Action plan containing exactly 3 clear, actionable operational guidelines to extend remaining useful life.
`;

      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              degradationCauses: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    factor: { type: Type.STRING },
                    impactPercentage: { type: Type.NUMBER },
                    description: { type: Type.STRING }
                  },
                  required: ['factor', 'impactPercentage', 'description']
                }
              },
              healthDiagnosis: { type: Type.STRING },
              riskAssessment: {
                type: Type.OBJECT,
                properties: {
                  level: { type: Type.STRING },
                  thermalRunawayRisk: { type: Type.STRING },
                  lithiumPlatingRisk: { type: Type.STRING },
                  cellDegradationRisk: { type: Type.STRING }
                },
                required: ['level', 'thermalRunawayRisk', 'lithiumPlatingRisk', 'cellDegradationRisk']
              },
              actionPlan: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              estimatedRemainingYears: { type: Type.NUMBER }
            },
            required: ['summary', 'degradationCauses', 'healthDiagnosis', 'riskAssessment', 'actionPlan', 'estimatedRemainingYears']
          }
        }
      });

      const parsedAnalysis: AIExplainResponse = JSON.parse(geminiResponse.text || '{}');
      res.json({ success: true, aiAnalysis: parsedAnalysis, source: 'gemini-3.6-flash' });

    } catch (error: any) {
      console.error('Error generating AI explanation:', error);
      res.status(500).json({ error: 'Failed to generate AI analysis', details: error.message });
    }
  });

  // API 4: Interactive Digital Doctor AI Chatbot
  app.post('/api/chat-digital-doctor', async (req, res) => {
    try {
      const { userQuery, context } = req.body;

      const ai = getGeminiClient();
      if (!ai) {
        const defaultReply = `[Digital Doctor Offline Mode] For your ${context?.vehicle?.name || 'EV Pack'} at ${context?.healthMetrics?.soh || 91}% SoH:
To extend battery life:
1. Avoid keeping your pack above 80% SoC for long idle periods.
2. Limit DC Fast Charging in temperatures above 38°C or below 0°C.
3. Precondition your battery in cold weather before fast charging.`;
        return res.json({ reply: defaultReply, suggestedActions: ['How to precondition battery in winter?', 'Explain internal resistance growth', 'Can I charge to 100% for long road trips?'] });
      }

      const systemPrompt = `You are the "Digital Doctor", an elite AI EV Battery Diagnostic Assistant powered by NASA/CALCE battery aging analytics.
Current Vehicle Context:
- Vehicle: ${context?.vehicle?.name || 'Tesla Model 3'} (${context?.vehicle?.model || '75kWh'})
- Chemistry: ${context?.vehicle?.chemistry || 'NMC'}
- State of Health (SoH): ${context?.healthMetrics?.soh || 91.2}%
- Temperature: ${context?.telemetry?.temperature || 28}°C
- Internal Resistance: ${context?.telemetry?.internalResistance || 14.5} mΩ
- Remaining Useful Life: ${context?.healthMetrics?.rulYears || 6.2} years (${context?.healthMetrics?.rulCycles || 980} cycles)
- Active Anomalies: ${JSON.stringify(context?.healthMetrics?.anomalies || [])}

Provide authoritative, concise, easy-to-understand diagnostic answers to the user's question. Focus on physical mechanisms (SEI layer, lithium plating, thermal degradation) and actionable tips for the EV driver or technician. Keep formatting clean with bullet points where helpful.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: userQuery,
        config: {
          systemInstruction: systemPrompt
        }
      });

      res.json({
        reply: response.text || 'Unable to generate reply.',
        suggestedActions: [
          'What causes battery internal resistance to spike?',
          'Is DC fast charging safe for high mileage packs?',
          'How does winter sub-zero driving affect my range?'
        ]
      });

    } catch (error: any) {
      console.error('Chat error:', error);
      res.status(500).json({ error: 'Chat service failure', details: error.message });
    }
  });

  // Serve static / Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Battery Intelligence Platform server listening on http://localhost:${PORT}`);
  });
}

startServer();

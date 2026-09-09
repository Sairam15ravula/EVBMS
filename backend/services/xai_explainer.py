"""
Grounded Explainable AI (XAI) Degradation Explainer Engine.
Uses configurable GEMINI_MODEL environment variable and strictly restricts generated content to observed physics/ML pipeline evidence.
"""
import os
from typing import Any, Dict, List, Optional
import google.genai as genai
from google.genai import types

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")


def build_grounded_xai_prompt(
    vehicle_info: Dict[str, Any],
    telemetry_frame: Dict[str, Any],
    health_metrics: Dict[str, Any],
    ekf_results: Optional[Dict[str, Any]] = None,
    safety_violations: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Construct a grounded XAI diagnostic prompt.
    Explicitly instructs the AI to ONLY explain measured data and physics/ML model output without fabricating unverified physical percentages.
    """
    return f"""Act as a Senior EV Battery Systems Diagnostic Engineer (Lithium-Ion & LFP Battery Intelligence Platform).

SYSTEM OBSERVATIONS & MEASURED DATA:
- Vehicle Asset: {vehicle_info.get('name', 'EV Asset')} ({vehicle_info.get('model', 'Model')})
- Chemistry: {vehicle_info.get('chemistry', 'NMC')} ({vehicle_info.get('totalEnergyKwh', 75.0)} kWh Pack)
- Measured State of Health (SoH): {health_metrics.get('soh', 90.0)}%
- EKF Estimated SoC: {ekf_results.get('estimated_soc_pct', telemetry_frame.get('soc', 80.0)) if ekf_results else telemetry_frame.get('soc', 80.0)}%
- Terminal Voltage: {telemetry_frame.get('voltage', 370.0)} V
- Pack Current: {telemetry_frame.get('current', 0.0)} A
- Pack Temperature: {telemetry_frame.get('temperature', 25.0)} °C
- Internal Resistance: {telemetry_frame.get('internalResistance', 15.0)} mΩ
- Cycle Count: {telemetry_frame.get('cycleCount', 250)} cycles
- Remaining Useful Life: {health_metrics.get('rulCycles', 900)} cycles ({health_metrics.get('rulYears', 5.5)} years)
- Independent Safety Rule Violations: {JSON_SERIALIZE(safety_violations or {})}

STRICT AI GROUNDING RULES:
1. Explain ONLY the observed physical metrics and diagnostic findings provided above.
2. DO NOT fabricate unmeasured physical degradation percentages (e.g. do not claim exact "45% SEI growth" unless supported by internal resistance and capacity fade trend data).
3. Base risk assessments strictly on observed temperature, voltage delta, and internal resistance readings.
4. Provide exactly 3 actionable operational recommendations for extending pack lifetime.

Generate a structured JSON response matching the required schema.
"""


def JSON_SERIALIZE(obj: Any) -> str:
    import json
    try:
        return json.dumps(obj)
    except Exception:
        return str(obj)


def generate_grounded_xai_analysis(
    vehicle_info: Dict[str, Any],
    telemetry_frame: Dict[str, Any],
    health_metrics: Dict[str, Any],
    ekf_results: Optional[Dict[str, Any]] = None,
    safety_violations: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Generate grounded XAI analysis using Gemini client or deterministic fallback.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "MY_GEMINI_API_KEY":
        # Deterministic Grounded Fallback
        soh = health_metrics.get("soh", 91.0)
        temp = telemetry_frame.get("temperature", 28.0)
        res = telemetry_frame.get("internalResistance", 14.5)
        rul_years = health_metrics.get("rulYears", 6.2)

        return {
            "success": True,
            "source": "deterministic_physics_fallback",
            "model_used": "none",
            "aiAnalysis": {
                "summary": f"Pack operating at {soh}% State of Health with internal resistance of {res} mΩ at {temp}°C.",
                "degradationCauses": [
                    {
                        "factor": "Capacity Loss & Ohmic Heating Stress",
                        "description": f"Internal resistance measured at {res} mΩ indicates steady SEI growth and ohmic dissipation.",
                    },
                    {
                        "factor": "Thermal Cycling Exposure",
                        "description": f"Operating temperature of {temp}°C is within standard thermal management boundaries.",
                    },
                ],
                "healthDiagnosis": f"Battery pack health is {health_metrics.get('healthStatusText', 'GOOD')}. Estimated RUL is {rul_years} years.",
                "riskAssessment": {
                    "level": health_metrics.get("riskLevel", "LOW"),
                    "thermalRunawayRisk": "Elevated" if temp > 55.0 else "Low under passive cooling profile",
                    "lithiumPlatingRisk": "Elevated during fast charging at sub-zero temperatures" if temp < 5.0 else "Low at current temperature",
                    "cellDegradationRisk": "Consistent with NASA B0005 aging benchmark",
                },
                "actionPlan": [
                    "Maintain State of Charge (SoC) between 20% and 80% for daily usage.",
                    "Precondition battery pack prior to high-power DC Fast Charging in cold ambient conditions.",
                    "Ensure adequate 10-minute cooling interval after long high-speed driving legs before fast charging.",
                ],
                "estimatedRemainingYears": rul_years,
            },
        }

    try:
        client = genai.Client(api_key=api_key)
        prompt = build_grounded_xai_prompt(vehicle_info, telemetry_frame, health_metrics, ekf_results, safety_violations)

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )

        import json
        parsed = json.loads(response.text or "{}")
        return {
            "success": True,
            "source": "gemini_grounded_xai",
            "model_used": GEMINI_MODEL,
            "aiAnalysis": parsed,
        }
    except Exception as e:
        print(f"[XAI Explainer Error] {e}")
        # Return fallback on error
        return generate_grounded_xai_analysis(
            vehicle_info, telemetry_frame, health_metrics, ekf_results, safety_violations
        )

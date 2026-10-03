"""Kaushal Radar pipeline configuration.

Everything a reviewer may want to change lives here: the pilot scope, the trade
taxonomy, the industrial clusters, and the model parameters.

NOTE ON DATA: district populations and boundaries are real (Census 2011, scaled
to 2026). Every labour-market series is SYNTHETIC, generated to be internally
consistent and shaped by real industrial geography. Replace the generator with
real feeds by dropping CSVs in pipeline/inputs/ (see ingest.py).
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
BUILD = ROOT / "build"
INPUTS = ROOT / "inputs"
OUT = ROOT.parent / "data"

SEED = 20261002

# ---------------------------------------------------------------- time axis --
START = "2022-10"   # first month generated
N_HIST = 48         # history months -> ends 2026-09 (latest data month)
N_FUT = 18          # forecast months -> ends 2028-03 (end of FY 2027-28)
DISPLAY_HIST = 36   # months of history shown in the product
PLAN_FY = 2028      # FY 2027-28 is the next training cycle being planned

# ------------------------------------------------------------------ states --
# growth: approx. 2011 -> 2026 population factor; wa: working-age (15-59) share.
STATES = {
    "MH": dict(name="Maharashtra", census="MAHARASHTRA", code="27", growth=1.135, wa=0.67, lang="mr", supply=1.00),
    "TN": dict(name="Tamil Nadu", census="TAMIL NADU", code="33", growth=1.07, wa=0.68, lang="ta", supply=0.95),
    "UP": dict(name="Uttar Pradesh", census="UTTAR PRADESH", code="09", growth=1.20, wa=0.62, lang="hi", supply=1.12),
    "GJ": dict(name="Gujarat", census="GUJARAT", code="24", growth=1.20, wa=0.66, lang="gu", supply=0.90),
}

# Districts created after Census 2011: child -> [(parent census code, share of parent)].
SPLITS = {
    ("MH", "Palghar"): [(517, 0.27)],
    ("TN", "Chengalpattu"): [(604, 0.64)],
    ("TN", "Ranipet"): [(605, 0.31)],
    ("TN", "Tirupathur"): [(605, 0.28)],
    ("TN", "Tenkasi"): [(628, 0.46)],
    ("TN", "Kallakurichi"): [(607, 0.40)],
    ("UP", "Amethi"): [(179, 0.33), (158, 0.18)],
    ("UP", "Hapur"): [(140, 0.29)],
    ("UP", "Shamli"): [(133, 0.31)],
    ("UP", "Sambhal"): [(135, 0.30), (149, 0.21)],
    ("GJ", "Aravalli"): [(472, 0.43)],
    ("GJ", "Botad"): [(481, 0.16), (474, 0.027)],
    ("GJ", "Chhota Udaipur"): [(486, 0.26)],
    ("GJ", "Devbhumi Dwarka"): [(477, 0.35)],
    ("GJ", "Gir Somnath"): [(479, 0.44)],
    ("GJ", "Mahisagar"): [(484, 0.31), (483, 0.11)],
    ("GJ", "Morbi"): [(476, 0.19), (475, 0.10), (477, 0.03)],
    ("GJ", "Vav-Tharad"): [(469, 0.31)],
}
# Census 2011 counted Mumbai City (519) and Mumbai Suburban (518) separately.
MERGES = {("MH", "Mumbai"): [518, 519]}
# Urban-share overrides where a split changed the character of the district.
URBAN_OVERRIDE = {
    ("MH", "Palghar"): 0.48, ("MH", "Thane"): 0.90, ("TN", "Chengalpattu"): 0.70,
    ("TN", "Kancheepuram"): 0.46, ("UP", "Hapur"): 0.33, ("UP", "Ghaziabad"): 0.82,
    ("GJ", "Vav-Tharad"): 0.09, ("GJ", "Botad"): 0.32, ("GJ", "Morbi"): 0.42,
}
# Current official names where the boundary file still carries the old one.
RENAME = {
    ("MH", "Aurangabad"): "Chhatrapati Sambhajinagar",
    ("MH", "Osmanabad"): "Dharashiv",
    ("MH", "Ahmednagar"): "Ahilyanagar",
    ("TN", "Thoothukkudi"): "Thoothukudi",
    ("TN", "Tirupathur"): "Tirupattur",
}

# ----------------------------------------------------------------- sectors --
SECTORS = [
    dict(id="ELEC", name="Electronics & Hardware", hi="इलेक्ट्रॉनिक्स एवं हार्डवेयर", ssc="ESSCI"),
    dict(id="AUTO", name="Automotive & Engineering", hi="ऑटोमोटिव एवं इंजीनियरिंग", ssc="ASDC / CGSC"),
    dict(id="GREEN", name="Green Jobs (Renewables)", hi="हरित रोजगार (नवीकरणीय ऊर्जा)", ssc="SCGJ"),
    dict(id="CONS", name="Construction & Building Services", hi="निर्माण एवं भवन सेवाएँ", ssc="CSDCI / PSC"),
    dict(id="TEXT", name="Textiles & Apparel", hi="वस्त्र एवं परिधान", ssc="AMHSSC / TSC"),
    dict(id="IT", name="IT-ITeS", hi="आईटी-आईटीईएस", ssc="IT-ITeS SSC"),
    dict(id="RETL", name="Retail", hi="खुदरा", ssc="RASCI"),
    dict(id="HLTH", name="Healthcare", hi="स्वास्थ्य सेवा", ssc="HSSC"),
    dict(id="LOGI", name="Logistics", hi="लॉजिस्टिक्स", ssc="LSC"),
]

# ------------------------------------------------------------------ trades --
# b      entry-level skilled openings per 100k working-age population per year (base FY 2024-25)
# ratio  legacy effective-supply / demand ratio at national level in the base year
# g      annual demand growth; (g1, "YYYY-MM", g2) = growth changes at that month
# urb    elasticity of demand to the district's urban share
# conc   0..1, how concentrated demand is in the sector's hubs
# hub    cluster key (see HUBS); hubp dampens the cluster multiplier
# online share of openings that surface on job portals in a typical urban district
# formal share of hiring visible in payroll (EPFO/ESIC) data
# naps   share visible as apprenticeship / employer-reported demand
# sg     annual growth in sanctioned seats (policy inertia)
# pres   share of districts that offer the course at all
def T(id, name, hi, sector, nco, nco_title, nsqf, kind, dur, b, ratio, g, urb, conc, hub,
      online, formal, naps, seas="flat", sg=0.03, pres=1.0, hubp=1.0, emerging=False, qp=None):
    return dict(id=id, name=name, hi=hi, sector=sector, nco=nco, nco_title=nco_title, nsqf=nsqf,
                kind=kind, dur=dur, b=b, ratio=ratio, g=g, urb=urb, conc=conc, hub=hub, hubp=hubp,
                online=online, formal=formal, naps=naps, seas=seas, sg=sg, pres=pres,
                emerging=emerging, qp=qp)


TRADES = [
    # ---- Electronics & Hardware
    T("ems-operator", "Electronics Assembly Operator", "इलेक्ट्रॉनिक्स असेंबली ऑपरेटर", "ELEC", "8212",
      "Electrical and electronic equipment assemblers", 3, "STT", 3, 7.5, 0.45, 0.22, 0.4, 0.80, "EMS",
      0.16, 0.70, 0.14, "manufacturing", sg=0.12, pres=0.55),
    T("mobile-repair", "Mobile Phone Hardware Repair Technician", "मोबाइल फोन हार्डवेयर रिपेयर तकनीशियन", "ELEC", "7422",
      "ICT installers and servicers", 4, "STT", 4, 4.0, 1.30, 0.02, 0.35, 0.10, "RETAIL",
      0.14, 0.15, 0.03, "flat", qp="ELE/Q8104"),
    T("field-tech-cp", "Field Technician – Computing & Peripherals", "फील्ड तकनीशियन – कंप्यूटिंग एवं पेरिफेरल्स", "ELEC", "7422",
      "ICT installers and servicers", 4, "STT", 4, 2.5, 1.95, -0.04, 0.6, 0.15, "IT",
      0.30, 0.35, 0.04, "flat", sg=0.0, hubp=0.4, qp="ELE/Q4601"),
    T("electronics-mech", "Electronics Mechanic (ITI)", "इलेक्ट्रॉनिक्स मैकेनिक (आईटीआई)", "ELEC", "7421",
      "Electronics mechanics and servicers", 4, "ITI", 24, 5.5, 0.75, 0.07, 0.4, 0.45, "EMS",
      0.14, 0.55, 0.22, "manufacturing", sg=0.02, pres=0.85, hubp=0.6),
    T("semicon-tech", "Semiconductor ATMP Technician", "सेमीकंडक्टर एटीएमपी तकनीशियन", "ELEC", "3114",
      "Electronics engineering technicians", 5, "STT", 6, 0.35, 0.20, 0.35, 0.3, 0.97, "SEMICON",
      0.45, 0.90, 0.20, "flat", sg=0.40, pres=0.06, emerging=True),
    # ---- Automotive & Engineering
    T("mmv", "Mechanic Motor Vehicle (ITI)", "मैकेनिक मोटर वाहन (आईटीआई)", "AUTO", "7231",
      "Motor vehicle mechanics and repairers", 4, "ITI", 24, 6.5, 1.05, 0.03, 0.3, 0.20, "AUTO",
      0.10, 0.35, 0.20, "flat", sg=0.01, pres=0.95, hubp=0.5),
    T("ev-tech", "EV Service Technician", "ईवी सर्विस तकनीशियन", "AUTO", "7231",
      "Motor vehicle mechanics and repairers", 4, "STT", 4, 1.8, 0.22, 0.35, 0.8, 0.55, "EV",
      0.28, 0.55, 0.15, "flat", sg=0.30, pres=0.22, emerging=True),
    T("auto-assembly", "Automotive Assembly Operator", "ऑटोमोटिव असेंबली ऑपरेटर", "AUTO", "8211",
      "Mechanical machinery assemblers", 3, "STT", 3, 5.0, 0.55, 0.06, 0.3, 0.85, "AUTO",
      0.12, 0.75, 0.30, "manufacturing", pres=0.5),
    T("cnc-operator", "CNC Operator (Turning / VMC)", "सीएनसी ऑपरेटर", "AUTO", "7223",
      "Metal working machine tool setters and operators", 4, "STT", 4, 4.5, 0.50, 0.07, 0.3, 0.75, "AUTO",
      0.18, 0.65, 0.28, "manufacturing", pres=0.6, hubp=0.9, qp="CSC/Q0115"),
    T("welder", "Welder (ITI)", "वेल्डर (आईटीआई)", "AUTO", "7212",
      "Welders and flame cutters", 4, "ITI", 12, 6.0, 0.85, 0.05, 0.25, 0.50, "AUTO",
      0.09, 0.45, 0.25, "manufacturing", sg=0.01, pres=0.95, hubp=0.7),
    T("fitter-iti", "Fitter (ITI)", "फिटर (आईटीआई)", "AUTO", "7233",
      "Agricultural and industrial machinery mechanics and repairers", 4, "ITI", 24, 6.0, 1.85, 0.02, 0.25, 0.55, "AUTO",
      0.10, 0.60, 0.30, "manufacturing", sg=0.0, pres=0.98, hubp=0.7),
    # ---- Green jobs
    T("solar-pv-installer", "Solar PV Installer (Suryamitra)", "सोलर पीवी इंस्टॉलर (सूर्यमित्र)", "GREEN", "7411",
      "Building and related electricians", 4, "STT", 3, 2.8, 0.40, 0.32, 0.35, 0.45, "SOLAR",
      0.18, 0.30, 0.06, "solar", sg=0.20, pres=0.45, hubp=0.55, emerging=True, qp="SGJ/Q0101"),
    T("solar-om-tech", "Solar Plant O&M Technician", "सोलर प्लांट ओ एंड एम तकनीशियन", "GREEN", "7412",
      "Electrical mechanics and fitters", 4, "STT", 4, 1.0, 0.30, 0.28, 0.0, 0.90, "SOLAR",
      0.22, 0.70, 0.10, "flat", sg=0.18, pres=0.18, emerging=True),
    T("wind-tech", "Wind Turbine Technician", "पवन टरबाइन तकनीशियन", "GREEN", "7412",
      "Electrical mechanics and fitters", 4, "STT", 6, 0.4, 0.35, 0.14, 0.0, 0.97, "WIND",
      0.25, 0.80, 0.12, "flat", sg=0.10, pres=0.07, emerging=True),
    # ---- Construction & building services
    T("electrician-iti", "Electrician (ITI)", "इलेक्ट्रीशियन (आईटीआई)", "CONS", "7411",
      "Building and related electricians", 4, "ITI", 24, 10.0, 1.50, 0.04, 0.3, 0.30, "CONSTRUCTION",
      0.08, 0.30, 0.22, "construction", sg=0.01, pres=1.0),
    T("asst-electrician", "Assistant Electrician", "सहायक इलेक्ट्रीशियन", "CONS", "7411",
      "Building and related electricians", 3, "STT", 3, 7.5, 1.10, 0.05, 0.3, 0.35, "CONSTRUCTION",
      0.05, 0.15, 0.05, "construction", qp="CON/Q0602"),
    T("mason", "Mason General", "राजमिस्त्री (सामान्य)", "CONS", "7112",
      "Bricklayers and related workers", 4, "STT", 3, 11.0, 0.35, 0.06, 0.3, 0.45, "CONSTRUCTION",
      0.03, 0.08, 0.02, "construction", pres=0.7, qp="CON/Q0103"),
    T("plumber", "Plumber (General)", "प्लंबर (सामान्य)", "CONS", "7126",
      "Plumbers and pipe fitters", 3, "STT", 3, 5.0, 0.50, 0.07, 0.45, 0.45, "CONSTRUCTION",
      0.06, 0.12, 0.04, "construction", pres=0.7, qp="PSC/Q0104"),
    T("hvac-tech", "Refrigeration & AC Technician (ITI)", "रेफ्रिजरेशन एवं एसी तकनीशियन (आईटीआई)", "CONS", "7127",
      "Air conditioning and refrigeration mechanics", 4, "ITI", 24, 3.5, 0.60, 0.12, 0.7, 0.40, "CONSTRUCTION",
      0.16, 0.35, 0.15, "flat", sg=0.03, pres=0.6),
    # ---- Textiles & apparel
    T("sewing-operator", "Sewing Machine Operator", "सिलाई मशीन ऑपरेटर", "TEXT", "8153",
      "Sewing machine operators", 3, "STT", 3, 15.0, 1.15, 0.03, 0.2, 0.80, "APPAREL",
      0.06, 0.45, 0.08, "apparel", qp="AMH/Q0301"),
    T("tailor-self", "Self-Employed Tailor", "स्व-नियोजित दर्जी", "TEXT", "7531",
      "Tailors, dressmakers, furriers and hatters", 4, "STT", 4, 5.5, 2.30, -0.02, 0.15, 0.05, "RETAIL",
      0.02, 0.03, 0.01, "flat", sg=0.0, qp="AMH/Q1947"),
    T("loom-operator", "Power Loom Operator (Shuttleless)", "पावरलूम ऑपरेटर (शटललेस)", "TEXT", "8152",
      "Weaving and knitting machine operators", 4, "STT", 3, 2.3, 0.30, 0.04, 0.1, 0.95, "LOOM",
      0.04, 0.30, 0.06, "apparel", pres=0.2),
    T("apparel-qc", "Apparel Inline Quality Checker", "परिधान इनलाइन गुणवत्ता जाँचकर्ता", "TEXT", "7543",
      "Product graders and testers", 4, "STT", 2, 2.0, 0.55, 0.04, 0.2, 0.88, "APPAREL",
      0.08, 0.55, 0.08, "apparel", pres=0.35),
    # ---- IT-ITeS
    T("data-entry", "Domestic Data Entry Operator", "डोमेस्टिक डेटा एंट्री ऑपरेटर", "IT", "4132",
      "Data entry clerks", 4, "STT", 3, 3.5, 2.40, -0.14, 0.8, 0.30, "IT",
      0.55, 0.40, 0.03, "flat", sg=-0.03, hubp=0.5, qp="SSC/Q2212"),
    T("copa", "Computer Operator & Programming Assistant (ITI)", "कंप्यूटर ऑपरेटर एवं प्रोग्रामिंग सहायक (आईटीआई)", "IT", "3512",
      "ICT user support technicians", 4, "ITI", 12, 4.5, 2.00, -0.05, 0.7, 0.30, "IT",
      0.40, 0.40, 0.08, "flat", sg=0.0, pres=0.98, hubp=0.5),
    T("jr-software-dev", "Junior Software Developer", "जूनियर सॉफ्टवेयर डेवलपर", "IT", "2512",
      "Software developers", 5, "STT", 6, 7.5, 0.80, (0.10, "2025-06", -0.13), 1.2, 0.80, "IT",
      0.80, 0.90, 0.04, "it", sg=0.05, pres=0.45, qp="SSC/Q0508"),
    T("crm-voice", "CRM Domestic Voice (BPO)", "सीआरएम डोमेस्टिक वॉइस (बीपीओ)", "IT", "4222",
      "Contact centre information clerks", 4, "STT", 3, 6.0, 1.00, (-0.08, "2025-09", -0.17), 1.0, 0.60, "IT",
      0.70, 0.75, 0.03, "it", sg=0.01, pres=0.6, hubp=0.7, qp="SSC/Q2210"),
    T("dc-tech", "Data Centre Technician", "डेटा सेंटर तकनीशियन", "IT", "3511",
      "ICT operations technicians", 5, "STT", 6, 0.45, 0.15, 0.38, 0.4, 0.97, "DATACENTRE",
      0.60, 0.90, 0.10, "flat", sg=0.30, pres=0.05, emerging=True),
    # ---- Retail
    T("retail-sales", "Retail Sales Associate", "रिटेल सेल्स एसोसिएट", "RETL", "5223",
      "Shop sales assistants", 4, "STT", 3, 24.0, 1.05, 0.03, 0.75, 0.10, "RETAIL",
      0.30, 0.35, 0.06, "retail", qp="RAS/Q0104"),
    T("retail-cashier", "Retail Cashier", "रिटेल कैशियर", "RETL", "5230",
      "Cashiers and ticket clerks", 3, "STT", 2, 4.5, 1.10, -0.03, 0.85, 0.10, "RETAIL",
      0.30, 0.45, 0.04, "retail", sg=0.01, pres=0.7),
    T("dist-salesman", "Distributor Salesman", "डिस्ट्रीब्यूटर सेल्समैन", "RETL", "3322",
      "Commercial sales representatives", 4, "STT", 3, 6.5, 0.70, 0.03, 0.5, 0.10, "RETAIL",
      0.32, 0.40, 0.03, "retail", pres=0.6, qp="RAS/Q0604"),
    # ---- Healthcare
    T("gda", "General Duty Assistant", "जनरल ड्यूटी असिस्टेंट", "HLTH", "5321",
      "Health care assistants", 4, "STT", 4, 7.5, 0.70, 0.09, 0.5, 0.40, "HEALTH",
      0.34, 0.50, 0.05, "health", sg=0.05, pres=0.8, qp="HSS/Q5101"),
    T("home-health-aide", "Home Health Aide", "होम हेल्थ एड", "HLTH", "5322",
      "Home-based personal care workers", 4, "STT", 4, 3.0, 0.35, 0.14, 1.0, 0.45, "HEALTH",
      0.38, 0.30, 0.02, "health", sg=0.06, pres=0.4, qp="HSS/Q5102"),
    T("emt", "Emergency Medical Technician – Basic", "आपातकालीन चिकित्सा तकनीशियन – बेसिक", "HLTH", "3258",
      "Ambulance workers", 4, "STT", 4, 1.3, 0.60, 0.06, 0.3, 0.25, "HEALTH",
      0.30, 0.65, 0.03, "health", pres=0.35, qp="HSS/Q2301"),
    T("mlt", "Medical Laboratory Technician", "मेडिकल लैब तकनीशियन", "HLTH", "3212",
      "Medical and pathology laboratory technicians", 4, "STT", 6, 2.5, 0.75, 0.07, 0.6, 0.40, "HEALTH",
      0.36, 0.55, 0.03, "health", pres=0.5, qp="HSS/Q0301"),
    T("pharmacy-asst", "Pharmacy Assistant", "फार्मेसी सहायक", "HLTH", "3213",
      "Pharmaceutical technicians and assistants", 4, "STT", 4, 3.0, 1.00, 0.05, 0.5, 0.20, "HEALTH",
      0.25, 0.30, 0.03, "health", pres=0.55, qp="HSS/Q5401"),
    # ---- Logistics
    T("warehouse-assoc", "Warehouse Associate", "वेयरहाउस एसोसिएट", "LOGI", "4321",
      "Stock clerks", 3, "STT", 2, 10.0, 0.45, 0.11, 0.6, 0.70, "LOGISTICS",
      0.24, 0.55, 0.06, "logistics", sg=0.06, pres=0.5),
    T("forklift-op", "Forklift Operator", "फोर्कलिफ्ट ऑपरेटर", "LOGI", "8344",
      "Lifting truck operators", 4, "STT", 2, 2.5, 0.40, 0.09, 0.4, 0.80, "LOGISTICS",
      0.20, 0.60, 0.06, "logistics", sg=0.05, pres=0.25),
    T("cv-driver", "Commercial Vehicle Driver", "वाणिज्यिक वाहन चालक", "LOGI", "8332",
      "Heavy truck and lorry drivers", 4, "STT", 3, 9.0, 0.30, 0.05, 0.3, 0.40, "LOGISTICS",
      0.10, 0.25, 0.03, "logistics", pres=0.45, hubp=0.6, qp="ASC/Q9703"),
    T("courier-exec", "Courier Delivery Executive", "कूरियर डिलीवरी एग्जीक्यूटिव", "LOGI", "9621",
      "Messengers, package deliverers and luggage porters", 3, "STT", 2, 12.0, 0.45, 0.10, 1.2, 0.30, "LOGISTICS",
      0.40, 0.30, 0.02, "logistics", sg=0.05, pres=0.4, hubp=0.5, qp="LSC/Q3023"),
]

# Training funnel. Yield = seats that end up as labour-market entrants.
FUNNEL = {
    "STT": dict(util=0.92, complete=0.80, certify=0.68, entry=0.78),
    "ITI": dict(util=0.72, complete=0.80, certify=0.78, entry=0.75),
}
ITI_UTIL = {"electrician-iti": 0.90, "fitter-iti": 0.86, "copa": 0.80, "welder": 0.60,
            "electronics-mech": 0.62, "mmv": 0.76, "hvac-tech": 0.70}

# Monthly seasonality (Jan..Dec), normalised to mean 1 at load time.
SEASON = {
    "flat": [1] * 12,
    "retail": [0.92, 0.88, 0.90, 0.92, 0.94, 0.95, 0.97, 1.00, 1.10, 1.20, 1.18, 1.10],
    "construction": [1.08, 1.10, 1.10, 1.05, 1.00, 0.92, 0.82, 0.80, 0.86, 1.00, 1.10, 1.12],
    "manufacturing": [1.02, 1.00, 1.03, 0.98, 0.97, 0.98, 1.00, 1.00, 1.02, 1.03, 1.00, 0.97],
    "apparel": [1.00, 1.04, 1.06, 1.00, 0.94, 0.92, 0.96, 1.02, 1.06, 1.04, 0.98, 0.98],
    "it": [1.08, 1.05, 1.00, 0.95, 0.95, 1.00, 1.08, 1.05, 1.00, 0.95, 0.92, 0.97],
    "logistics": [0.95, 0.93, 0.95, 0.96, 0.97, 0.98, 1.00, 1.03, 1.10, 1.16, 1.10, 1.00],
    "solar": [1.08, 1.10, 1.10, 1.06, 1.02, 0.90, 0.82, 0.84, 0.92, 1.02, 1.06, 1.08],
    "health": [1.04, 1.02, 1.00, 0.98, 0.97, 0.97, 1.00, 1.02, 1.02, 1.00, 0.99, 1.01],
}

# ---------------------------------------------------------- industrial hubs --
# Demand multipliers for districts where a sector is clustered. Keys use the
# district names in the boundary file. Unlisted districts take FLOOR[hub].
HUBS = {
    "EMS": {
        "TN": {"Kancheepuram": 30, "Chengalpattu": 14, "Krishnagiri": 22, "Thiruvallur": 6, "Chennai": 3, "Coimbatore": 3},
        "UP": {"Gautam Buddha Nagar": 30, "Ghaziabad": 4, "Lucknow": 2},
        "GJ": {"Ahmedabad": 5, "Gandhinagar": 2, "Vadodara": 2.5, "Kutch": 1.5},
        "MH": {"Pune": 4, "Thane": 2, "Aurangabad": 2.5, "Nashik": 2, "Mumbai": 1.5},
    },
    "SEMICON": {
        "GJ": {"Ahmedabad": 40}, "UP": {"Gautam Buddha Nagar": 12},
        "TN": {"Kancheepuram": 8, "Chengalpattu": 6}, "MH": {"Pune": 4},
    },
    "AUTO": {
        "MH": {"Pune": 9, "Aurangabad": 5, "Nashik": 4, "Kolhapur": 2.5, "Nagpur": 1.5, "Ahmednagar": 2, "Thane": 2, "Raigad": 2, "Satara": 2},
        "TN": {"Kancheepuram": 8, "Chengalpattu": 7, "Thiruvallur": 6, "Krishnagiri": 7, "Chennai": 3, "Coimbatore": 4,
               "Tiruchirappalli": 2.5, "Ranipet": 3, "Vellore": 1.5, "Salem": 1.5},
        "GJ": {"Ahmedabad": 6, "Rajkot": 5, "Vadodara": 4, "Mehsana": 4, "Panchmahal": 3, "Surat": 2, "Jamnagar": 3,
               "Bharuch": 2.5, "Kutch": 2, "Morbi": 2},
        "UP": {"Gautam Buddha Nagar": 5, "Ghaziabad": 4, "Lucknow": 2, "Kanpur Nagar": 3, "Agra": 2, "Meerut": 2,
               "Aligarh": 2, "Moradabad": 1.5},
    },
    "EV": {
        "MH": {"Pune": 6, "Mumbai": 4, "Thane": 3, "Nagpur": 2},
        "TN": {"Chennai": 5, "Krishnagiri": 6, "Kancheepuram": 4, "Coimbatore": 3},
        "GJ": {"Ahmedabad": 5, "Surat": 3, "Vadodara": 2, "Rajkot": 2},
        "UP": {"Lucknow": 3, "Gautam Buddha Nagar": 5, "Ghaziabad": 3, "Kanpur Nagar": 2, "Varanasi": 1.5, "Agra": 1.5},
    },
    "SOLAR": {
        "GJ": {"Kutch": 14, "Banaskantha": 8, "Patan": 9, "Surendranagar": 6, "Vav-Tharad": 6, "Jamnagar": 3, "Bhavnagar": 2, "Amreli": 2},
        "TN": {"Ramanathapuram": 9, "Tirunelveli": 6, "Thoothukkudi": 7, "Virudhunagar": 5, "Tenkasi": 3, "Sivaganga": 3,
               "Tiruppur": 2, "Dindigul": 2},
        "UP": {"Jhansi": 7, "Lalitpur": 8, "Banda": 5, "Chitrakoot": 5, "Jalaun": 5, "Mahoba": 4, "Hamirpur": 4,
               "Mirzapur": 5, "Sonbhadra": 3, "Prayagraj": 2, "Kanpur Dehat": 2},
        "MH": {"Solapur": 6, "Dhule": 7, "Osmanabad": 5, "Latur": 4, "Beed": 4, "Nandurbar": 3, "Satara": 2,
               "Ahmednagar": 2, "Jalgaon": 2},
    },
    "WIND": {
        "TN": {"Tirunelveli": 25, "Thoothukkudi": 14, "Kanyakumari": 16, "Tenkasi": 14, "Tiruppur": 12, "Coimbatore": 8,
               "Dindigul": 4, "Theni": 6},
        "GJ": {"Kutch": 30, "Jamnagar": 10, "Devbhumi Dwarka": 14, "Rajkot": 6, "Morbi": 5, "Porbandar": 5, "Amreli": 4,
               "Surendranagar": 4, "Bhavnagar": 4},
        "MH": {"Satara": 10, "Sangli": 8, "Dhule": 8, "Ahmednagar": 5, "Nandurbar": 4, "Kolhapur": 3},
    },
    "APPAREL": {
        "TN": {"Tiruppur": 12, "Coimbatore": 4, "Erode": 5, "Karur": 5, "Chennai": 2.5, "Kancheepuram": 2, "Madurai": 2,
               "Salem": 2, "Namakkal": 2, "Dindigul": 1.5, "Virudhunagar": 2},
        "GJ": {"Surat": 6, "Ahmedabad": 4, "Navsari": 1.5, "Valsad": 1.5},
        "UP": {"Gautam Buddha Nagar": 6, "Kanpur Nagar": 3, "Ghaziabad": 2, "Lucknow": 2, "Varanasi": 2, "Bareilly": 1.5, "Agra": 1.5},
        "MH": {"Mumbai": 1.5, "Thane": 3, "Solapur": 3, "Nagpur": 1.5, "Kolhapur": 2, "Pune": 1.2, "Palghar": 2},
    },
    "LOOM": {
        "MH": {"Thane": 14, "Nashik": 9, "Kolhapur": 12, "Solapur": 6, "Sangli": 3},
        "GJ": {"Surat": 18, "Ahmedabad": 4, "Navsari": 2},
        "TN": {"Erode": 12, "Salem": 9, "Namakkal": 8, "Karur": 8, "Tiruppur": 8, "Coimbatore": 7, "Virudhunagar": 4,
               "Madurai": 2, "Dindigul": 2},
        "UP": {"Varanasi": 6, "Mau": 9, "Ambedkar Nagar": 6, "Meerut": 4, "Gorakhpur": 3, "Sant Kabir Nagar": 4,
               "Azamgarh": 3, "Bhadohi": 5, "Mirzapur": 3},
    },
    "IT": {
        "MH": {"Pune": 9, "Mumbai": 6, "Thane": 5, "Nagpur": 2, "Nashik": 1.3, "Aurangabad": 1.2},
        "TN": {"Chennai": 9, "Kancheepuram": 4, "Chengalpattu": 6, "Coimbatore": 4, "Madurai": 1.5, "Tiruchirappalli": 1.5},
        "GJ": {"Ahmedabad": 4, "Gandhinagar": 6, "Vadodara": 2, "Surat": 1.5, "Rajkot": 1.2},
        "UP": {"Gautam Buddha Nagar": 12, "Lucknow": 3, "Ghaziabad": 3, "Kanpur Nagar": 1.3, "Prayagraj": 1.1, "Varanasi": 1.1},
    },
    "DATACENTRE": {
        "MH": {"Mumbai": 20, "Thane": 30, "Raigad": 10, "Pune": 10},
        "TN": {"Chennai": 14, "Kancheepuram": 8, "Chengalpattu": 10, "Thiruvallur": 6},
        "UP": {"Gautam Buddha Nagar": 28, "Lucknow": 3},
        "GJ": {"Gandhinagar": 10, "Ahmedabad": 5},
    },
    "LOGISTICS": {
        "MH": {"Thane": 7, "Raigad": 6, "Pune": 5, "Mumbai": 3, "Nagpur": 3, "Palghar": 3, "Nashik": 2, "Aurangabad": 2},
        "TN": {"Thiruvallur": 6, "Kancheepuram": 5, "Chengalpattu": 4, "Chennai": 4, "Coimbatore": 3, "Krishnagiri": 3,
               "Thoothukkudi": 3, "Madurai": 1.5, "Tiruchirappalli": 1.5},
        "GJ": {"Kutch": 7, "Ahmedabad": 5, "Surat": 4, "Bharuch": 3, "Vadodara": 2.5, "Rajkot": 2, "Jamnagar": 2,
               "Gandhinagar": 1.5, "Valsad": 2, "Morbi": 2},
        "UP": {"Gautam Buddha Nagar": 7, "Ghaziabad": 4, "Lucknow": 4, "Kanpur Nagar": 4, "Varanasi": 2.5, "Agra": 2,
               "Prayagraj": 2, "Meerut": 2, "Unnao": 2, "Hapur": 2, "Gorakhpur": 1.5},
    },
    "HEALTH": {
        "MH": {"Mumbai": 2.5, "Pune": 2.5, "Nagpur": 2, "Thane": 1.8, "Aurangabad": 1.5, "Nashik": 1.3},
        "TN": {"Chennai": 3, "Coimbatore": 2.5, "Vellore": 3, "Madurai": 2, "Tiruchirappalli": 1.5, "Kancheepuram": 1.5},
        "GJ": {"Ahmedabad": 2.5, "Surat": 1.8, "Vadodara": 1.8, "Rajkot": 1.5, "Gandhinagar": 1.5, "Anand": 1.5},
        "UP": {"Lucknow": 3, "Varanasi": 2, "Gautam Buddha Nagar": 2.2, "Ghaziabad": 1.8, "Kanpur Nagar": 1.8,
               "Prayagraj": 1.5, "Gorakhpur": 1.8, "Meerut": 1.5, "Agra": 1.5, "Bareilly": 1.4},
    },
    "CONSTRUCTION": {
        "MH": {"Mumbai": 1.6, "Thane": 2.4, "Pune": 2.6, "Raigad": 2.2, "Nagpur": 1.6, "Nashik": 1.4, "Palghar": 1.6},
        "TN": {"Chennai": 1.8, "Chengalpattu": 2.4, "Kancheepuram": 2.2, "Coimbatore": 2, "Krishnagiri": 1.8,
               "Thiruvallur": 1.8, "Madurai": 1.3},
        "GJ": {"Ahmedabad": 2.6, "Surat": 2.4, "Gandhinagar": 2.2, "Vadodara": 1.6, "Rajkot": 1.6, "Kutch": 1.5, "Bharuch": 1.6},
        "UP": {"Gautam Buddha Nagar": 3.2, "Lucknow": 2.4, "Ghaziabad": 2.2, "Ayodhya": 2.2, "Varanasi": 1.8,
               "Kanpur Nagar": 1.5, "Prayagraj": 1.5, "Gorakhpur": 1.5, "Agra": 1.4, "Meerut": 1.5},
    },
    "RETAIL": {},
}
FLOOR = {"EMS": 0.25, "SEMICON": 0.01, "AUTO": 0.35, "EV": 0.5, "SOLAR": 0.6, "WIND": 0.03, "APPAREL": 0.35,
         "LOOM": 0.08, "IT": 0.4, "DATACENTRE": 0.02, "LOGISTICS": 0.5, "HEALTH": 0.8, "CONSTRUCTION": 0.8, "RETAIL": 1.0}

# ------------------------------------------------ events already in history --
# (state, district, [trades], start month, months to ramp, level multiplier, label)
PAST_EVENTS = [
    ("TN", "Krishnagiri", ["ems-operator", "electronics-mech"], "2025-01", 9, 1.6, "Electronics manufacturing capacity came online"),
    ("GJ", "Ahmedabad", ["semicon-tech"], "2025-07", 12, 1.6, "First ATMP line began hiring"),
    ("UP", "Gautam Buddha Nagar", ["warehouse-assoc", "forklift-op", "mason", "asst-electrician"], "2025-10", 8, 1.3, "Airport and logistics zone ramp-up"),
    ("MH", "Thane", ["dc-tech", "hvac-tech"], "2026-02", 8, 1.8, "Hyperscale data-centre campuses"),
    ("MH", "Raigad", ["dc-tech"], "2026-02", 8, 1.6, "Hyperscale data-centre campuses"),
]
# Temporary export shock on apparel hubs: (state, district) -> depth, Aug 2025 to Jan 2026, recovers by Apr 2026.
EXPORT_SHOCK = {("TN", "Tiruppur"): 0.30, ("TN", "Coimbatore"): 0.18, ("TN", "Karur"): 0.25, ("TN", "Erode"): 0.15,
                ("GJ", "Surat"): 0.15, ("UP", "Gautam Buddha Nagar"): 0.20, ("UP", "Kanpur Nagar"): 0.15}
EXPORT_SHOCK_TRADES = ["sewing-operator", "apparel-qc", "loom-operator"]

# ---------------------------------------------- investment pipeline (future) --
# Illustrative projects modelled on publicly announced programmes. Job numbers
# and dates are assumptions for the demo, not official figures.
PIPELINE = [
    dict(id="P01", state="GJ", district="Ahmedabad", month="2027-01", title="Semiconductor fab and ATMP cluster (Dholera / Sanand)",
         sector="ELEC", jobs={"semicon-tech": 2200, "ems-operator": 900, "hvac-tech": 300, "electrician-iti": 250}, p=0.7),
    dict(id="P02", state="UP", district="Gautam Buddha Nagar", month="2026-12", title="Electronics manufacturing cluster, phase 2 (YEIDA)",
         sector="ELEC", jobs={"ems-operator": 6500, "semicon-tech": 700, "electronics-mech": 500, "warehouse-assoc": 600}, p=0.75),
    dict(id="P03", state="TN", district="Krishnagiri", month="2027-03", title="EV and electronics expansion (Hosur)",
         sector="AUTO", jobs={"ev-tech": 900, "auto-assembly": 2600, "ems-operator": 2400, "cnc-operator": 500}, p=0.75),
    dict(id="P04", state="MH", district="Pune", month="2027-02", title="EV and battery manufacturing (Chakan / Talegaon)",
         sector="AUTO", jobs={"auto-assembly": 2400, "ev-tech": 800, "cnc-operator": 600, "welder": 400}, p=0.7),
    dict(id="P05", state="GJ", district="Kutch", month="2026-11", title="Renewable energy park, next phases (Khavda)",
         sector="GREEN", jobs={"solar-om-tech": 1400, "wind-tech": 500, "solar-pv-installer": 700, "electrician-iti": 300}, p=0.8),
    dict(id="P06", state="TN", district="Thoothukkudi", month="2027-04", title="Green hydrogen and port-led manufacturing",
         sector="GREEN", jobs={"solar-om-tech": 600, "welder": 700, "warehouse-assoc": 900, "forklift-op": 300}, p=0.6),
    dict(id="P07", state="UP", district="Kanpur Nagar", month="2027-01", title="Defence industrial corridor node",
         sector="AUTO", jobs={"cnc-operator": 1100, "welder": 800, "fitter-iti": 600}, p=0.6),
    dict(id="P08", state="MH", district="Raigad", month="2026-12", title="Airport-linked logistics park (Navi Mumbai)",
         sector="LOGI", jobs={"warehouse-assoc": 2600, "forklift-op": 700, "cv-driver": 900, "courier-exec": 800}, p=0.8),
    dict(id="P09", state="UP", district="Jhansi", month="2027-06", title="Bundelkhand solar parks",
         sector="GREEN", jobs={"solar-om-tech": 700, "solar-pv-installer": 800}, p=0.65),
    dict(id="P10", state="TN", district="Chengalpattu", month="2027-02", title="Data-centre and global capability centre campuses",
         sector="IT", jobs={"dc-tech": 650, "hvac-tech": 350, "jr-software-dev": 900}, p=0.7),
    dict(id="P11", state="GJ", district="Navsari", month="2026-10", title="PM MITRA integrated textile park",
         sector="TEXT", jobs={"sewing-operator": 4200, "loom-operator": 1200, "apparel-qc": 500}, p=0.7),
    dict(id="P12", state="UP", district="Hardoi", month="2027-01", title="PM MITRA integrated textile park (Lucknow–Hardoi)",
         sector="TEXT", jobs={"sewing-operator": 3600, "loom-operator": 700, "apparel-qc": 450}, p=0.6),
    dict(id="P13", state="MH", district="Amravati", month="2026-12", title="PM MITRA integrated textile park",
         sector="TEXT", jobs={"sewing-operator": 3000, "loom-operator": 900, "apparel-qc": 350}, p=0.65),
    dict(id="P14", state="TN", district="Virudhunagar", month="2027-01", title="PM MITRA integrated textile park",
         sector="TEXT", jobs={"sewing-operator": 3200, "loom-operator": 800, "apparel-qc": 400}, p=0.65),
    dict(id="P15", state="UP", district="Lucknow", month="2027-03", title="Medical and super-speciality hospital expansion",
         sector="HLTH", jobs={"gda": 1500, "mlt": 400, "emt": 200, "home-health-aide": 300}, p=0.7),
    dict(id="P16", state="MH", district="Nagpur", month="2027-02", title="Multi-modal logistics hub (MIHAN)",
         sector="LOGI", jobs={"warehouse-assoc": 1500, "forklift-op": 400, "cv-driver": 600}, p=0.65),
]

# ------------------------------------------------------- signal definitions --
# The demand sources the index combines. `noise` is the multiplicative noise
# (log sd) the generator applies; the pipeline re-estimates it from the data.
SOURCES = [
    dict(id="portal", name="Online job postings", stands_for="Private job portals via API partnership, de-duplicated and NLP-coded to NCO-2015",
         freq="daily", lag=0, noise=0.24),
    dict(id="ncs", name="NCS vacancies", stands_for="National Career Service portal, vacancies by district and occupation",
         freq="daily", lag=0, noise=0.42),
    dict(id="payroll", name="Formal payroll additions", stands_for="EPFO / ESIC net payroll additions by establishment district and industry",
         freq="monthly", lag=2, noise=0.20),
    dict(id="naps", name="Apprenticeship and employer demand", stands_for="Apprenticeship openings and employer demand posted on Skill India Digital Hub",
         freq="daily", lag=0, noise=0.38),
]
LEADING = [
    dict(id="enterprise", name="New enterprise registrations", stands_for="Udyam / GST new registrations by NIC sector and district", lead=6),
    dict(id="pipeline", name="Investment pipeline", stands_for="Announced projects with expected employment (DPIIT IEMs, state investment MoUs)", lead=12),
]

# ------------------------------------------------------------- model params --
SHRINK_K = 8.0           # empirical-Bayes prior strength, in raw observations per cell-month
SCORE_K = 1.2            # steepness of the severity score: 100 * tanh(K * ln(D/S))
CLASS_CUTS = (25, 60)    # |score| below 25 = balanced, above 60 = acute / saturated
PLAN_MAX_UP = 0.40       # largest seat increase the planner recommends in one cycle
PLAN_MAX_DOWN = 0.30     # largest seat cut in one cycle
PLAN_BAND = 0.15         # do nothing if seats are within +/-15% of need

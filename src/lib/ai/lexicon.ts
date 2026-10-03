// Vocabulary for the built-in matcher: how each trade is actually described in
// Indian job advertisements, in English, Hindi and the usual mix of the two.
// The language model does the same job better; this keeps the tool working
// without it.

export const TERMS: Record<string, string[]> = {
  "ems-operator": ["smt", "pcb", "pcb assembly", "electronics assembly", "assembly operator", "line operator", "soldering", "ems", "mobile assembly", "smt operator", "wave soldering", "electronics production", "असेंबली ऑपरेटर", "इलेक्ट्रॉनिक्स असेंबली", "पीसीबी"],
  "mobile-repair": ["mobile repair", "mobile technician", "smartphone repair", "handset repair", "mobile phone hardware", "chip level", "mobile mechanic", "मोबाइल रिपेयर", "मोबाइल मैकेनिक"],
  "field-tech-cp": ["field technician", "computer hardware", "desktop support", "printer", "peripherals", "laptop repair", "hardware engineer", "computer technician", "कंप्यूटर हार्डवेयर"],
  "electronics-mech": ["electronics mechanic", "electronic technician", "iti electronics", "instrument technician", "electronics maintenance", "इलेक्ट्रॉनिक्स मैकेनिक"],
  "semicon-tech": ["semiconductor", "atmp", "osat", "wafer", "cleanroom", "clean room", "chip packaging", "wire bonding", "die attach", "fab technician", "सेमीकंडक्टर"],
  mmv: ["motor mechanic", "mmv", "automobile mechanic", "car mechanic", "vehicle mechanic", "service mechanic", "two wheeler mechanic", "bike mechanic", "automobile technician", "मोटर मैकेनिक", "गाड़ी मैकेनिक"],
  "ev-tech": ["ev technician", "electric vehicle", "ev service", "battery pack", "bms", "e-rickshaw", "ev charging", "charging station", "इलेक्ट्रिक वाहन", "ईवी"],
  "auto-assembly": ["automotive assembly", "assembly line", "vehicle assembly", "production associate", "line associate", "automobile production", "shop floor operator", "assembly operator automotive"],
  "cnc-operator": ["cnc", "vmc", "cnc operator", "cnc turning", "cnc machinist", "machinist", "lathe", "cnc programmer", "hmc", "सीएनसी"],
  welder: ["welder", "welding", "mig", "tig", "arc welding", "fabricator", "gas cutter", "वेल्डर", "वेल्डिंग"],
  "fitter-iti": ["fitter", "iti fitter", "mechanical fitter", "maintenance fitter", "millwright", "फिटर"],
  "solar-pv-installer": ["solar installer", "solar pv", "solar panel", "rooftop solar", "suryamitra", "solar technician", "pv installer", "सोलर", "सौर", "सोलर पैनल"],
  "solar-om-tech": ["solar o&m", "solar plant", "solar operation", "solar maintenance", "scada solar", "o&m technician", "solar park"],
  "wind-tech": ["wind turbine", "wind technician", "wtg", "wind farm", "wind energy", "पवन"],
  "electrician-iti": ["electrician", "iti electrician", "wireman", "electrical technician", "industrial electrician", "licensed electrician", "इलेक्ट्रीशियन", "बिजली मिस्त्री"],
  "asst-electrician": ["assistant electrician", "electrician helper", "house wiring", "wiring helper", "electrical helper", "सहायक इलेक्ट्रीशियन"],
  mason: ["mason", "bricklayer", "brick work", "plastering", "tile mason", "raj mistri", "rajmistri", "राजमिस्त्री", "मिस्त्री"],
  plumber: ["plumber", "plumbing", "pipe fitting", "sanitary", "प्लंबर", "नलसाज"],
  "hvac-tech": ["hvac", "ac technician", "air conditioner", "refrigeration", "chiller", "cold storage technician", "ac mechanic", "एसी टेक्नीशियन", "एसी मैकेनिक"],
  "sewing-operator": ["sewing machine operator", "sewing operator", "stitching operator", "garment operator", "juki", "overlock", "garment factory", "silai", "सिलाई ऑपरेटर", "सिलाई मशीन"],
  "tailor-self": ["tailor", "boutique", "ladies tailor", "dressmaker", "alteration", "tailoring", "darji", "दर्जी"],
  "loom-operator": ["loom", "power loom", "powerloom", "weaver", "weaving", "rapier", "airjet", "shuttleless", "करघा", "बुनकर"],
  "apparel-qc": ["quality checker", "inline checker", "garment qc", "apparel qc", "final checker", "measurement checker", "garment quality", "क्वालिटी चेकर"],
  "data-entry": ["data entry", "data entry operator", "deo", "typing", "back office", "computer operator", "डेटा एंट्री", "डाटा एंट्री"],
  copa: ["copa", "computer operator and programming assistant", "iti copa", "कोपा"],
  "jr-software-dev": ["software developer", "software engineer", "developer", "programmer", "java", "python", "react", "node", "full stack", "frontend", "backend", "web developer", "सॉफ्टवेयर डेवलपर"],
  "crm-voice": ["bpo", "call center", "call centre", "customer care", "customer support", "voice process", "telecaller", "tele caller", "telesales", "domestic voice", "कॉल सेंटर", "टेलीकॉलर"],
  "dc-tech": ["data center", "data centre", "datacenter", "noc", "rack", "server technician", "dc technician", "colocation", "डेटा सेंटर"],
  "retail-sales": ["sales associate", "retail sales", "store associate", "showroom sales", "counter sales", "store sales", "shop sales", "showroom", "सेल्स एसोसिएट", "दुकान"],
  "retail-cashier": ["cashier", "billing executive", "billing counter", "pos", "कैशियर"],
  "dist-salesman": ["distributor salesman", "fmcg sales", "field sales", "sales representative", "dsr", "van sales", "order booker", "सेल्समैन"],
  gda: ["general duty assistant", "gda", "patient care", "nursing assistant", "ward boy", "ward assistant", "patient care assistant", "hospital attendant", "नर्सिंग असिस्टेंट", "वार्ड बॉय"],
  "home-health-aide": ["home health aide", "home care", "caregiver", "care taker", "caretaker", "elder care", "bedside attendant", "home nursing", "देखभाल"],
  emt: ["emt", "emergency medical technician", "ambulance", "paramedic", "एम्बुलेंस"],
  mlt: ["lab technician", "medical lab", "mlt", "dmlt", "pathology", "phlebotomist", "phlebotomy", "लैब टेक्नीशियन"],
  "pharmacy-asst": ["pharmacy assistant", "pharmacist assistant", "medical store", "chemist shop", "pharmacy", "फार्मेसी", "मेडिकल स्टोर"],
  "warehouse-assoc": ["warehouse", "picker", "packer", "picker packer", "inventory", "store keeper", "storekeeper", "fulfilment", "fulfillment", "godown", "loader", "वेयरहाउस", "गोदाम", "पैकर"],
  "forklift-op": ["forklift", "fork lift", "reach truck", "mhe operator", "stacker", "फोर्कलिफ्ट"],
  "cv-driver": ["truck driver", "heavy driver", "hmv", "trailer driver", "commercial driver", "lorry driver", "bus driver", "tanker driver", "ट्रक ड्राइवर"],
  "courier-exec": ["delivery boy", "delivery executive", "courier", "delivery partner", "rider", "last mile", "delivery associate", "डिलीवरी बॉय", "डिलीवरी"],
};

/** Industrial towns and older names, mapped to the district that contains them. */
export const PLACE_ALIASES: Record<string, string> = {
  noida: "up-gautam-buddha-nagar", "greater noida": "up-gautam-buddha-nagar", jewar: "up-gautam-buddha-nagar",
  kanpur: "up-kanpur-nagar", allahabad: "up-prayagraj", banaras: "up-varanasi", faizabad: "up-ayodhya",
  bombay: "mh-mumbai", "navi mumbai": "mh-thane", bhiwandi: "mh-thane", chakan: "mh-pune", talegaon: "mh-pune",
  "pimpri": "mh-pune", aurangabad: "mh-chhatrapati-sambhajinagar", ahmednagar: "mh-ahilyanagar", osmanabad: "mh-dharashiv",
  madras: "tn-chennai", sriperumbudur: "tn-kancheepuram", oragadam: "tn-kancheepuram", hosur: "tn-krishnagiri",
  tirupur: "tn-tiruppur", trichy: "tn-tiruchirappalli", tuticorin: "tn-thoothukudi", siruseri: "tn-chengalpattu",
  sanand: "gj-ahmedabad", dholera: "gj-ahmedabad", mundra: "gj-kutch", kandla: "gj-kutch", khavda: "gj-kutch",
  baroda: "gj-vadodara", "gift city": "gj-gandhinagar", vapi: "gj-valsad", hazira: "gj-surat",
  // the larger centres as they are written in Hindi, Marathi, Gujarati and Tamil advertisements
  "झांसी": "up-jhansi", "झाँसी": "up-jhansi", "नोएडा": "up-gautam-buddha-nagar", "लखनऊ": "up-lucknow", "कानपुर": "up-kanpur-nagar",
  "वाराणसी": "up-varanasi", "बनारस": "up-varanasi", "आगरा": "up-agra", "मेरठ": "up-meerut", "गाजियाबाद": "up-ghaziabad",
  "प्रयागराज": "up-prayagraj", "इलाहाबाद": "up-prayagraj", "गोरखपुर": "up-gorakhpur", "बरेली": "up-bareilly",
  "अलीगढ़": "up-aligarh", "मुरादाबाद": "up-moradabad",
  "पुणे": "mh-pune", "मुंबई": "mh-mumbai", "नागपुर": "mh-nagpur", "नागपूर": "mh-nagpur", "नाशिक": "mh-nashik", "नासिक": "mh-nashik",
  "ठाणे": "mh-thane", "औरंगाबाद": "mh-chhatrapati-sambhajinagar", "कोल्हापूर": "mh-kolhapur", "कोल्हापुर": "mh-kolhapur",
  "सोलापूर": "mh-solapur", "सोलापुर": "mh-solapur",
  "अहमदाबाद": "gj-ahmedabad", "सूरत": "gj-surat", "वडोदरा": "gj-vadodara", "राजकोट": "gj-rajkot",
  "અમદાવાદ": "gj-ahmedabad", "સુરત": "gj-surat", "વડોદરા": "gj-vadodara", "રાજકોટ": "gj-rajkot",
  "चेन्नई": "tn-chennai", "कोयंबटूर": "tn-coimbatore", "मदुरै": "tn-madurai",
  "சென்னை": "tn-chennai", "கோயம்புத்தூர்": "tn-coimbatore", "மதுரை": "tn-madurai", "திருப்பூர்": "tn-tiruppur",
  "ஓசூர்": "tn-krishnagiri", "காஞ்சிபுரம்": "tn-kancheepuram", "திருச்சி": "tn-tiruchirappalli", "சேலம்": "tn-salem",
};

export const STATE_ALIASES: Record<string, string> = {
  maharashtra: "MH", "tamil nadu": "TN", tamilnadu: "TN", "uttar pradesh": "UP", gujarat: "GJ",
  "महाराष्ट्र": "MH", "तमिलनाडु": "TN", "उत्तर प्रदेश": "UP", "गुजरात": "GJ", "यूपी": "UP",
  "மகாராஷ்டிரா": "MH", "தமிழ்நாடு": "TN", "ગુજરાત": "GJ", "મહારાષ્ટ્ર": "MH",
};

export const SKILL_WORDS = [
  "soldering", "esd", "5s", "kaizen", "iti", "diploma", "10th", "12th", "graduate", "fresher", "night shift",
  "rotational shift", "two wheeler", "driving licence", "driving license", "typing", "excel", "tally", "ms office",
  "communication", "hindi", "english", "java", "python", "react", "sql", "autocad", "plc", "scada", "mig", "tig",
  "blueprint reading", "vernier", "micrometer", "safety", "ppe", "customer handling", "billing", "inventory",
  "first aid", "bls", "patient handling", "sewing", "overlock", "quality check", "wiring", "multimeter",
];

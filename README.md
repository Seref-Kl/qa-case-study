# QA Case Study

Bu proje iki test türünü içerir:
1. **Integration Tests (K6, JavaScript)**  
   - REST API: [RestCountries](https://restcountries.com/v3.1/all)  
   - GraphQL API: [Rick & Morty](https://rickandmortyapi.com/graphql)

2. **E2E Tests (Playwright, Python)**  
   - Site: [SauceDemo](https://www.saucedemo.com/)

---

## 🚀 Kurulum

### 1️⃣ K6 Testleri
```bash
cd k6
k6 run rest/restcountries-smoke.js
k6 run graphql/rickmorty-characters.js
```

### 2️⃣ Playwright (Python)
```bash
cd playwright-python
pip install -r requirements.txt
pytest --headed --video on --tracing on
```

---

## 🧩 CI/CD
Proje, GitHub Actions üzerinden otomatik testleri çalıştırır:
- `.github/workflows/k6-integration.yml`
- `.github/workflows/playwright-e2e.yml`


## 🧭 Test Strategy & Coverage
- **k6 REST**: `/name/turkey` ve `/alpha/tr` happy path; `invalidendpoint` 404 edge; şema (`name.common`, `cca2`) ve fonksiyonel doğrulamalar. **SLA p95 < 500ms**, **error rate < %1** (yalnızca `expected_response:true` üzerinde).
- **k6 GraphQL**: `characters(page:1)` happy path; `invalidField` edge. **Retry + backoff + timeout** ve erişim kesilirse **Countries GraphQL fallback**. **SLA p95 < 500ms**, **error rate < %1** (yalnızca `expected_response:true`).
- **Playwright**: login success/failure; liste → ürün detay; sepete ekle → checkout (ödeme öncesi). Hata halinde **screenshot/video/trace** artefact’ları.

## ⚙️ Run Locally (macOS/Linux)
```bash
# k6
k6 run k6/rest/restcountries-smoke.js
k6 run k6/graphql/rickmorty-characters.js

# Playwright
cd playwright-python
python3 -m venv venv && source venv/bin/activate
python -m pip install -U pip
pip install -r requirements.txt
python -m playwright install chromium
pytest -m "e2e or smoke" -v
```

## 📝 SLA Rationale
Başlangıç için p95 **< 500ms** ve hata oranı **< %1** pratik eşiklerdir; trendlere göre sıkılaştırılabilir.

## 🧪 CI Outputs
- k6 özetleri: **k6-summaries** artifact’ında (`restcountries-summary.json`, `rickmorty-summary.json`)
- Playwright raporları: **playwright-report**, **playwright-junit**, **playwright-screenshots/videos/traces** artifact’larında

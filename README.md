# 🛒 Shopify Product Creation Automation (n8n + Puppeteer + Centrano)

This project is an **automation workflow** built in [n8n](https://n8n.io/) that connects a supplier’s website (Centrano) to a Shopify store.  
It automatically logs in, searches for products, extracts structured product data, and creates products in Shopify via API.

---

## 🔧 Features
- **Automated login & session handling** with Centrano  
- **Web scraping with Puppeteer & n8n** to collect:
  - Product title, vendor, product type, tags
  - Description, specifications
  - Sizes, colours
  - Images
  - Price (converted from EUR → RON)
- **Data cleaning**:
  - Removes unnecessary text (e.g., "Trotineta Freestyle")
  - Normalizes titles (`Deck Tilt Formula` instead of `Tilt Formula Deck`)
  - Matches vendors and product types against predefined lists
- **Shopify API integration** to create products instantly in the store

---

## 🖥️ Tech Stack
- [n8n](https://n8n.io/) (workflow automation platform)  
- Puppeteer (headless browser for scraping images)  
- JavaScript (custom nodes for data cleaning/parsing)  
- Shopify API (REST)  

---

## 🚀 Workflow Overview
1. **Login Node** → Authenticate with Centrano  
2. **Scraper Nodes** → Extract product details & images  
3. **Data Cleaning Nodes** → Normalize title, detect vendor/product type, format price  
4. **Shopify Node** → Create new product in Shopify store with full metadata  

---

## 📸 Example Output
**Input (Centrano product page):**  
`Tilt Formula Deck Trotineta Freestyle – 189,95 €`  

**Output (Shopify):**  
- Title: `Deck Tilt Formula`  
- Vendor: `Tilt`  
- Product type: `Deck`  
- Tags: `Tilt, Deck`  
- Price: `950 RON`  
- Description, specs, images, variants automatically included  

---

## ⚡ Why This Matters
Manually copying product data into Shopify is repetitive and error-prone.  
This automation:
- Saves hours of manual work  
- Ensures consistency across the product catalog  
- Makes scaling a Shopify store much easier  

---

## 📂 Repository Structure
- `Pride Shopify Centrano Product Automation.json` → The full n8n workflow  
- `README.md` → Project documentation  

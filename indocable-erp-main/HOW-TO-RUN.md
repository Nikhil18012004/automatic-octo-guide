# How to Run Indocable ERP

## First Time Setup (do this once)

### Step 1 — Install Node.js
Go to https://nodejs.org → Download the "LTS" version → Install it

### Step 2 — Open Terminal / Command Prompt
- On Mac: Press Cmd+Space, type "Terminal", press Enter
- On Windows: Press Win key, type "cmd", press Enter

### Step 3 — Navigate to this folder
Type this and press Enter (replace the path with where this folder is saved):
```
cd "/Users/parthchhaperia/Documents/Claude/Projects/Indocable ERP/indocable-erp"
```

### Step 4 — Install dependencies (only once)
```
npm install
```
Wait for it to finish (1-2 minutes).

### Step 5 — Run the app
```
npm run dev
```

### Step 6 — Open in browser
Go to: http://localhost:5173

---

## Every time after that
Just open Terminal, navigate to the folder, and run:
```
npm run dev
```

---

## Build for deployment (Vercel)
```
npm run build
```
Then upload the `dist` folder to Vercel.

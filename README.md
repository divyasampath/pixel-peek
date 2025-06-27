# 🚀 PixelPeek – A Visual Inspector for Developers & Designers

**PixelPeek** is a powerful Chrome Extension that overlays visual tools directly onto any webpage. It enables developers, designers, and testers to measure, inspect, and copy CSS properties **without ever opening DevTools**.

---

## 🔍 What is PixelPeek?

PixelPeek is an in-browser visual inspection tool that makes layout and style analysis seamless. With floating overlays and a draggable toolbar, it helps you:

- Visualize **margin**, **padding**, and **typography**
- Copy computed CSS styles
- Perform pixel-perfect design QA

---

## 🧰 Key Features

### 🎛️ Draggable In-Page Toolbar
- A floating toolbar that appears on any page
- Switch between **Margin**, **Padding**, **Font Info**, and **Copy CSS** modes
- Can be **dragged** or **minimized** for convenience

---

### 📏 Margin Mode
- Highlights element margins visually on hover
- Displays **top, right, bottom, and left** margin values with clean labels
- Labels use dark text on white background for clarity

---

### 📦 Padding Mode
- Works like Margin Mode but for **padding**
- Helps identify inner spacing issues instantly

---

### 🔤 Font Info Mode
- Hover over any text to see:
  - `font-size`
  - `font-family`
  - `font-weight`
  - `color`
- Displays a non-intrusive tooltip near the element

---

### 📋 Copy CSS Mode
- Click any element to **copy its computed CSS** properties
- Instant feedback via toast notification

---

## ♿ Accessibility & Usability

- All overlays and tooltips are rendered in **Shadow DOM** to avoid style collisions
- Works across most modern sites with minimal impact
- Enable/disable per tab using the popup

---

## ⚙️ How It Works

### 🔸 Content Script (`src/content_script.js`)
- Injects the toolbar

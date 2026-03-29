# **Project Specification: AromaCalc MVP (Revised)**

## **1\. Executive Summary**

AromaCalc is a specialized "Local-First" web application for aromatherapy recipe creation. Unlike standard calculators, it treats **Base Oil Volume** as the total reference for safety percentages, excluding essential oil volume from the "Total Volume" divisor. The UI is designed for a seamless "Flow State," where categories are created via drag-and-drop and calculations appear immediately next to inputs.

---

## **2\. Technical Stack**

* **Frontend:** React (Vite) \+ `dnd-kit` (for Drag & Drop).  
* **Persistence:** `Dexie.js` (IndexedDB).  
* **Math:** Constraint-driven logic based on Base Oil reference.  
* **Data:** JSON (Full Backup/Import), CSV (Report Export).

---

## **3\. Data Schema**

### **3.1 The Learned Library (`oils`)**

The library tracks ingredients and the user’s preferred safety defaults.

* `name`: String (Unique ID).  
* `lastUsedMaxPercent`: Float (Optional, defaults to null).

### **3.2 The Recipe (`recipes`)**

Categories exist **only** within the context of a recipe.

* `title`: String.  
* `baseOils`: Array of `{ name, ratio, isFixedVolume: boolean, volumeML: float }`.  
* `categories`: Array of `{ id, name, essentialOils: [] }`.  
  * `essentialOils`: Array of `{ name, drops, maxPercentLimit: float }`.

---

## **4\. The "Base-Centric" Calculation Logic**

### **4.1 Total Base Volume (Vbase​)**

The total volume is determined by the summation of all base oils.

* **The Reference Oil:** The user designates one base oil as the "Fixed" amount (e.g., Jojoba \= 50ml).  
* **Ratio Scaling:** Other base oils scale based on their "parts" relative to the fixed oil.  
  * *Example:* Sesame (1.2 parts), Jojoba (1 part, Fixed at 50ml).  
  * *Result:* Sesame \= 50×1.2=60ml.  
  * Vbase​=50+60=110ml.

### **4.2 Safety Guardrails (Inline)**

Essential oils are measured in drops (1 drop=0.05ml). The safety percentage is calculated **against the Base Volume only**.

* **Current %:** Vbase​Drops×0.05​×100.  
* **Safety Threshold:** If the "Current %" exceeds the "Max % Limit" defined for that oil, the app alerts the user inline and suggests the Vbase​ required to meet the limit.

---

## **5\. UI/UX: The "One-Page Workspace"**

### **5.1 The Drag-and-Drop Category System**

* **Dynamic Grouping:** Users can create a category (e.g., "Mid-Tone") and drag essential oils into it.  
* **Inline Proportions:** Next to the Category Header, the app displays the total percentage of drops in that category relative to the total drops in the recipe.

### **5.2 Inline Feedback (Immediate Recipe Making)**

No "Results" section at the bottom. Data is displayed as follows:

* **Base Oil Row:** `[Name] [Ratio] [ML Output]` (ML updates as ratios or fixed volumes change).  
* **Essential Oil Row:** `[Name] [Drops] [Max % Limit] [Current % Output]`.  
* **Safety Highlight:** If `Current % > Max % Limit`, the `Current %` text turns red, and a tooltip appears: *"Increase Base Volume to X ml to be safe."*

---

## **6\. Implementation Snippet (Calculation Hook)**

JavaScript

// core-logic.js

export const calculateBaseVolumes \= (baseOils) \=\> {

  const fixed \= baseOils.find(b \=\> b.isFixedVolume);

  if (\!fixed) return baseOils;

  const mlPerPart \= fixed.volumeML / fixed.ratio;


  return baseOils.map(b \=\> ({

    ...b,

    calculatedML: b.ratio \* mlPerPart

  }));

};

export const getSafetyStatus \= (drops, maxPercent, totalBaseML) \=\> {

  const oilML \= drops \* 0.05;

  const currentPercent \= (oilML / totalBaseML) \* 100;

  const isSafe \= maxPercent ? currentPercent \<= maxPercent : true;


  return {

    currentPercent: currentPercent.toFixed(2),

    isSafe,

    suggestedBaseML: maxPercent ? (oilML / (maxPercent / 100)) : null

  };

};

---

## **7\. Data Portability (JSON & CSV)**

### **7.1 JSON Import (System Migration)**

* The import must parse the `recipes` array.  
* **Library Sync:** For every oil found in the import, update the local `oils` library with the `maxPercentLimit` from the file to keep the "Recent used %" up to date.

### **7.2 CSV Export (The Recipe Sheet)**

Export a simple table for the therapist to follow while mixing: `Recipe Name, Ingredient, Type, Amount (Drops/ML), % of Base`

---

## **8\. Summary for Developer**

1. **Prioritize the "Reference Oil" logic:** The user must be able to toggle which base oil is the "Fixed Volume" anchor.  
2. **Drag-and-Drop:** Use `dnd-kit` to allow moving oils between category blocks.  
3. **Real-Time State:** Every input change should trigger a re-calculation of the `totalBaseML` and subsequent safety percentages for all oils in the list.  
4. **Local Storage:** Save the state of the active recipe to `Dexie` on every change to prevent data loss.


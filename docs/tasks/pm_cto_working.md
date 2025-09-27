## **FEATURE CHANGE REQUEST TEMPLATE**

**Copy this template and fill in all \[FILL THIS\] sections**

### **Change Request: Farmer Registration Form Update**  **1\. CURRENT SITUATION**

**What exists today?** The current farmer registration form includes fields grouped under "Farmer Type," "Agricultural Information," “Document Uploads”. 

**What's the problem with the current version?** The section headers and field grouping are unclear. "Agricultural Information" is not intuitive for **bank viewers and the Administrator (Telagri)**  needs to be renamed and simplified. 

**How do users currently work around this?** We don’t know yet we are currently in the observation stage.

### **2\. PROPOSED CHANGES**

**What should change?** 

- After clicking the **Add Farmer** button, the bank viewer and administrator (Telagri) should see **two main sections**:

1. **Service Cost Calculation**

2. **Farmer Details**

The specific information to be filled in under each section is provided in the **DETAILED REQUIREMENTS**.

- The **Farmer Type** field, which is currently present during farmer addition, should be **removed**.

**What should stay the same?** 

- Irrigation Type field.   
- The **“Document Uploads” function** field can remain unchanged. However, the names of the uploaded documents need to be **renamed according to the detailed specifications** provided in **section 3: DETAILED REQUIREMENTS**.


**Why make this change now?**

To improve data quality and usability of farmer profiles. 

### **3\. DETAILED REQUIREMENTS**

**Changes to User Interface:**

* When a bank viewer or administrator (Telagri) adds a farmer, the system must store the registration date so that the bank and administrator (Telagri) can see when each farmer was added to the database.

**Changes to Functionality:**

- After clicking the **Add Farmer** button, there are **two main sections**:

  1\. **Service Cost Calculation**

  \- The calculator will display the calculated amount, and after clicking the NEXT button, the user proceeds to fill in the Farm Details information.   
  Fields to be completed in the calculator and the price calculation logic: 

  [https://docs.google.com/spreadsheets/d/1aTDnNVdjYchKpuZ73Qt1Q1OYREtdPZZi/edit?gid=1546896284\#gid=1546896284](https://docs.google.com/spreadsheets/d/1aTDnNVdjYchKpuZ73Qt1Q1OYREtdPZZi/edit?gid=1546896284#gid=1546896284)  
   

#### Concept

* The calculator returns a **Service Cost (EUR)** as the sum of 7 priced components.

* The **selected crop** determines which **tariff** table to use for all other fields.

### Formula

total \=

  crop\_base \+

  area \+

  reservoirs \+

  outermost\_distance \+

  plant\_age\_groups \+

  varieties \+

  road\_distance

If a chosen option doesn’t exist in the active tariff’s price table, treat it as **0** and (ideally) show a non-blocking warning.

---

2\) Tariffs (which crops belong where)

* **Tariff T1 (super-intensive set)**

   Blueberry, Blackberry, Raspberry, Apple (super-intensive, with support system),

   Pear (super-intensive, with support system), Peach (super-intensive, with support system),

   Cherry (super-intensive, with support system), Plum (super-intensive, with support system),

   Nectarine (super-intensive, with support system), Almond (super-intensive), Grapes

* **Tariff T2 (semi-intensive/intensive \+ nuts/stones)**

   Almond (semi-intensive and intensive), Hazelnut, Walnut,

   Apple (semi-intensive and intensive), Pear (semi-intensive and intensive),

   Peach (semi-intensive and intensive), Cherry (semi-intensive and intensive),

   Plum (semi-intensive and intensive), Nectarine (semi-intensive and intensive),

   Pomegranate, Apricot

Both tariffs have **crop\_base \= €500**.

---

### 3\) Pricing Tables

#### 3.1 T1 (Super-intensive set)

**Area → €**

* 0–5 ha: 200

* 6–10 ha: 400

* 11–15 ha: 600

* 16–20 ha: 800

* 21–30 ha: 1,000

* 31–40 ha: 1,200

* 41–50 ha: 1,400

* 51–70 ha: 1,600

* 71–100 ha: 1,800

* 101–150 ha: 2,000

* 151–200 ha: 2,200

* 201–300 ha: 2,400

* 301–500 ha: 2,600

* Over 500 hectares: 2,800

**Number of reservoirs → €**

* 0–1: 500

* 2: 1,000

* 3: 1,500

* 4: 2,000

* 5: 2,500

* 6 or more: 5,000

**Longest distance between two outermost plots → €**

* Less than 100 m.: 100

* 100–300 m.: 250

* 300 m – 1 km: 500

* 1–3 km: 1,000

* More than 3 km: 3,000

**Number of different plant ages cultivated → €**

* 1: 200 … 9: 1,800

* More than 10: 2,000

**Number of varieties cultivated → €**

* 1: 200 … 9: 1,800

* More than 10: 2,000

**Approx. distance from nearest sector to asphalt road → €**

* Up to 1 km: 50

* 1–3 km: 100

* 3–10 km: 200

* More than 10 km: 300

  ---

#### 3.2 T2 (Semi-intensive/intensive \+ nuts/stones)

**Area → €**

* 0–5 ha: 100

* 6–10 ha: 200

* 11–15 ha: 300

* 16–20 ha: 400

* 21–30 ha: 500

* 31–40 ha: 600

* 41–50 ha: 700

* 51–70 ha: 800

* 71–100 ha: 900

* 101–150 ha: 1,000

* 151–200 ha: 1,100

* 201–300 ha: 1,200

* 301–500 ha: 1,300

* 500 ha: 1,400

**Number of reservoirs → €**

* 0–1: 500

* 2: 1,000

* 3: 1,500

* 4: 2,000

* 5: 2,500

   *(no “6 or more” for T2; if selected, price=0 unless you add it)*

**Longest distance between two outermost plots → €**

* Less than 100 m: 100

* 100–300 m: 250

* 300 m – 1 km: 500

* 1 km – 3 km: 1,000

* More than 3 km: 3,000

**Number of different plant ages cultivated → €**

* 1: 100 … 9: 900

* More than 10: 1,000

**Number of varieties cultivated → €**

* 1: 100 … 9: 900

* More than 10: 1,000

**Approx. distance from nearest sector to asphalt road → €**

* Up to 1 km: 50

* 1–3 km: 100

* 3–10 km: 200

* More than 10 km: 300

  ---

### 4\) Data Model (suggested keys)

* crop → string (exact label from the lists above)

* tariff \= "T1" or "T2" (derived from crop)

* area → string (exact label)

* reservoirs → string (exact label)

* outermostDistance → string (exact label)

* plantAges → string (exact label)

* varieties → string (exact label)

* roadDistance → string (exact label)

**Important:** Use the **exact option labels** as keys into the price maps.

---

### 5\) Pseudocode Logic

function resolveTariff(crop):

  if crop in T1\_crops: return "T1"

  else if crop in T2\_crops: return "T2"

function priceOf(tariff, tableName, label):

  table \= FEES\[tariff\]\[tableName\]

  return table\[label\] if exists else 0

function calculate(selection):

  tariff \= resolveTariff(selection.crop)

  parts \= {

    crop\_base: FEES\[tariff\].crop\_base,

    area: priceOf(tariff, "area\_fee", selection.area),

    reservoirs: priceOf(tariff, "reservoirs\_fee", selection.reservoirs),

    outermost\_distance: priceOf(tariff, "outermost\_distance\_fee", selection.outermostDistance),

    plant\_age\_groups: priceOf(tariff, "plant\_age\_groups\_fee", selection.plantAges),

    varieties: priceOf(tariff, "variety\_count\_fee", selection.varieties),

    road\_distance: priceOf(tariff, "road\_distance\_fee", selection.roadDistance)

  }

  total \= sum(parts.values)

  return { tariff, parts, total }

---

### 6\) Example Calculations

### **Example A —** 

### **T1 minimal**

* Crop: **Blueberry** → tariff **T1** (crop\_base 500\)

* Area: **0–5 ha** → 200

* Reservoirs: **0–1** → 500

* Outermost distance: **Less than 100 m.** → 100

* Plant ages: **1** → 200

* Varieties: **1** → 200

* Road distance: **Up to 1 km** → 50

**Total** \= 500 \+ 200 \+ 500 \+ 100 \+ 200 \+ 200 \+ 50 \= **€1,750**

---

### **Example B —** 

### **T1 high**

* Crop: **Apple (super-intensive, with support system)** → T1 (500)

* Area: **Over 500 hectares** → 2,800

* Reservoirs: **6 or more** → 5,000

* Outermost distance: **More than 3 km** → 3,000

* Plant ages: **More than 10** → 2,000

* Varieties: **More than 10** → 2,000

* Road distance: **More than 10 km** → 300

**Total** \= 500 \+ 2,800 \+ 5,000 \+ 3,000 \+ 2,000 \+ 2,000 \+ 300 \= **€15,600**

---

### **Example C —** 

### **T2 minimal**

* Crop: **Hazelnut** → tariff **T2** (500)

* Area: **0–5 ha** → 100

* Reservoirs: **0–1** → 500

* Outermost distance: **Less than 100 m** → 100

* Plant ages: **1** → 100

* Varieties: **1** → 100

* Road distance: **Up to 1 km** → 50

**Total** \= 500 \+ 100 \+ 500 \+ 100 \+ 100 \+ 100 \+ 50 \= **€1,450**

---

### **Example D —** 

### **T2 max (defined options)**

* Crop: **Walnut** → T2 (500)

* Area: **\> 500 ha** → 1,400

* Reservoirs: **5** → 2,500

* Outermost distance: **More than 3 km** → 3,000

* Plant ages: **More than 10** → 1,000

* Varieties: **More than 10** → 1,000

* Road distance: **More than 10 km** → 300

**Total** \= 500 \+ 1,400 \+ 2,500 \+ 3,000 \+ 1,000 \+ 1,000 \+ 300 \= **€8,700**

---

### 7\) Edge Cases & Rules

* **Unknown option** in a selected tariff → price **0** (do not crash).  
* **Different labels across tariffs** (e.g., punctuation/spacing) are **intentional**; use them exactly.  
* **Enable calculation only** when all 7 fields are chosen.  
* **Tariff switching:** when crop changes, reload valid option lists for that tariff.  
* **Line-item breakdown** should always accompany the total.

    
  **2\. Farm Details**

**Farm Details**

**Confluence document where this flow is explained graphically:** 

[https://agronnect1.atlassian.net/wiki/spaces/shared/whiteboard/436797441?atl\_f=PAGETREE](https://agronnect1.atlassian.net/wiki/spaces/shared/whiteboard/436797441?atl_f=PAGETREE)

All items must have titles. Each title is followed by the bold text.

### **1\. Personal Information \***

Under this section, the following fields need to be filled in.

* **About Company**  
  * Company Name  
  * Identification Code  
  * Company Email  
* **Company Director**  
  * First/Last Name  
  * Mobile

* **Contact Person**  
  * First/Last Name  
  * Mobile

Note: Each field in this section must allow text input, including both letters and numbers.

**2\. Farm Overview\***

* Location   
  * when clicking this input it should open a google map where the user will be able to search and it gives suggestions about places, use google maps `place-autocomplete`.   
  * After choosing location it should save location name itself, latitude and longitude  
  * Google maps key is defined in application as env variable \`VITE\_APP\_GOOGLE\_MAPS\_API\_KEY\`  
* Cadastral Codes  
  * *User should be able to enter multiple codes*  
* Upload (KML/KMZ Files)


**3\. Historical soil Analyses \***

- Upload button that allows uploading of: PDF / Word (.doc, .docx) / Excel (.xls, .xlsx) / Image formats (.jpg, .jpeg, .png)

**4\. Last Yield\***

*\- Ability to enter a number, with “Tone” displayed next to it.*

**5\. Loan Details**

* Loan Amount  
  \- Ability to enter a number with a currency selector button next to it and user should be able to choose between \`USD, GEL\`   
* Loan Duration  
  \- A calendar should appear, allowing selection of the start and end dates of the loan period.  
* Loan Issuance Date  
  A calendar should appear, allowing selection of the date when the loan was issued.  
* Loan details section should have \`Add anorhet loan\` button to the left side with \`+\` icon. By default this view (with fields) should be visible and pressing on this button a new line of loan adding should be created.

#### **Add Another Loan**  \- There should be the ability to add one or multiple loans along with their details.

**6\. Comment about the farm**

* The bank viewer and Telagri administrator should have the ability to enter comments in text format. 

**7\. Other (Upload files)**

**\-** upload file button![][image1]. 

**Final Action Button:**

* **Register Farmer**

- **After the bank clicks the ‘Register Farmer’ button, a pop-up message should appear with the following text:**

  *You have successfully registered the farmer. The Telagri team will review the information you provided and confirm receipt of the request.*

**Changes to User Flow:**

* \[FILL THIS \- How should the process change?\]

### 

### **4\. IMPACT ANALYSIS**

**Who will be affected?**

* The bank and **Administrator (Telagri)**  will be able to register farmers directly.  
* **Administrator (Telagri)** will have the ability to automatically receive information about farmers registered by the bank.

**Will this break existing workflows?** No. Existing farmer records remain unchanged. Only new registrations will use the updated form. 

**Do users need training on the changes?** Minimal

### **5\. SUCCESS CRITERIA**

**How will we know the change is successful?** 

- Banks complete registration without confusion.   
- Reduction in user support requests related to farmer registration. 

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnAAAAHzCAYAAACg3yBIAABWJklEQVR4Xu29Z7Mc15Wmq48z8z/mTjcJEFTM3JiYLzPRPRHzQRE3uqeHUl8p2mtuSz1StzwlsSmJFEUjQvSeILwhRFL0AAiCFjSgBUEHWoBwhAfhvcmLlZUra+XKnVWVu7LOOXnwPBGvltk7TdWBUC937sL50pe//OUEAAAAACY+n2/blYh3+1JTBk5OiBBCCCGEwmoCOU+jBg4AAAAARgsGDgAAAKBlYOAAAAAAWgYGDgAAAKBlYOAAAAAAWgYGDgAAAKBlYOAAAAAAWgYGDgAAAKBlYOAAAAAAWgYGDgAAAKBlYOAAAAAAWgYGDgAAAKBlYOAAAAAAWgYGDgAAAKBlYOAAAAAAWgYGDgAAAKBlYOAAAAAAWgYGDgAAAKBlYOAAAAAAWgYGDgAAAKBlYOAAAAAAWgYGboJy6vSpVBOBJu9jy54dybETx30bAAAAajAyA/efLv56QS98sNpPCbL/yKHSsXcuv89Paw3yugd97RZ97aOg1z2t+ujt0pjcx6fbNhV6Mehruuy+O/0QAAAA1GAkBu6//uIf0g/qv5j+w7T+H7/+dlofPHrYzSyjH/IfbFmfPPXOK3k9+9lH/NRWEGvEYo8bhF7nDo1JPayBe+z150vnBQAAgDhGYuDkg/qf7v6Nb/clZB5Cfa19/+s3/DStr39sfmHslqX35vXne3YWzvE3t1ya57L69IPZ0/PaPupbvubl4DW1PnHqZOGcdkx1/6oV+XGKn3P6zJlC/xeLb8tzMcZVx/79rb8s9RUZ09pfz+LH9HqSi4Eb5Dh7H8qdT95fmDPn2UfT/s8W3Bg8p9ar13+QxnnPPZb3Bv15AQAATGZGZuB2H9hb+HD+9f13+Wkl/Ad5CJ3z7HuvJRfPv6FwjBo4WfF7+LVnC9eXD3s7V3MxBK998m5h7nPvv1GYqyuKMnfvoQPB84heNecR1m5el9eSy+Nhi469s/GTZMXb3dVGOyZauvqFPL/24dmFcfs+/HLx7YUxxRo4f0+Wj7duLIzpqpv2nnjrpfy90PNp/sa695OHXn0mzW9essieNtlzcF9y4+ML8vPKe6iG+KFXn07HQ+cUiRl//dP381p+BgtWLinM8T8vAACAyU5u4KZMmerHorArUfII9cyZM3m9afd2P73AIB/CMi6GRrnnqQfzY9TAKf58P5p7XV77sbuefKDyWD9XTZwdO3L8WD4utZojf2wv1BwJoeP8Pdn3wY/ZY62BC41bQmNSL37xiUJtr/WTedcHxywPvvJ0sK/4c/q5vtevBgAAmMyIgRPv1vgKnP8wlfqbt19W6HlCx1nk8aKMHzjS3Uv3SfZoT+hn4K64/+689mPyWM/WX7nyO6W5XnbMIvWgBs6fs995RaH3odexTRg4uwcudC0vT8jA6d5If1zoHL7na/vzAgAAmOyM7BHqX910SaknH9i98B/Kob7ElWvfzMfue3l5PjZqAxciNCb1IAbOj9VdgbPvgx+rOm9o3BIak7qXgbv6wZn5WBXewOk59J8o8ecM3UPoeAUDBwAA5xIjM3Ciny24Ka11pWXb3l3pB7bkoQ3np0+fLnywyz46/WD+l5m/TefY8Zc+XFP4IB+1gdN/zuRbd15RGrNI7Q3c0RPdR6yKPdZ+0cKO/dk13ys8lpZr23H7PshcQd+H9Tu2pKt09rz2WHm/PfqzumThzXlP6l4GTiSPyv2YpcrACfLt5NA5Lb7nawwcAACcS4zEwAn6AavSfVL6yFO+YRjCf9tR9NXrfpKPqwG0UvMwKgMnfGfGVYVr6r+V5s+jPTVw9ssT/luo8gUEe87QCpyXEnofLLbvH6Hab4V6rIn230JV/LG97kPxBk4fA3sJofP4nq/9zwsAAGAyMzIDBwAAAACjAQMHAAAA0DIwcAAAAAAtAwMHAAAA0DIwcAAAAAAtAwMHAAAA0DIwcAAAAAAtAwMHAAAA0DIwcAAAAAAtAwMHAAAA0DIwcAAAAAAtAwMHAAAA0DIwcAAAAAAtAwMHAAAA0DIwcAAAAAAtAwMHAAAA0DIwcAAAAAAtAwMHAAAA0DIwcAAAAAAtAwMHAAAA0DIwcAAAAAAtAwMHAAAA0DIwcAAAAAAtAwMHAAAA0DIwcAAAAAAtAwMHAAAA0DJGYuD+y5/8eUF79+33U/oix4Wo6ofw93Hq1Ck/ZVxZfP+jyaWXT/ftaP77V75ees0AAAAw+RiZgVO2fL6tUH++dXuyes17eS1s3LQlNVcvrXo979ljDh46nM7x/aPHjiWPL3s6aMzUzChyDlvv2r0nWfbks3kt6DUeW/pU3rNzDhw4mOze80WyfcfOZNPmrWnvrbffS/uWT9Z9lqx88dW8lmsdOnw4zZ9+7qW8f+31dyR/948/TN+TEI88/mRy4uTJvNb7e/Otd5Pdu7/I+4p/zZZHl6xIzpw5k9d6Lnn/tD59dnzVq2/mc+QYi9yL9Hbu2p33/HkAAABg9IzcwMmHvdY//9VvS6tDYr5s7xt/993SOSRfv2FTob9h4+bCcadPn87n67zDh48UenMW3J9GMVz2WDWAtuclzJ53X/Kd71+a937/wGN5fvGlV6VzxLxpTwyVIMdcNf3W0vl8bQmNST79xrtKfaXKwNlz3TFjfqnna6/QeY4dO17qAQAAwNgwMgMX+mC3Jkv7auB8X6KOfbpuQz6uSP+JFc/5dk4vQyFjuhr1tb/+P4Vr2jk2F9MnBk7737/4suQr//Nv01xW0arOIa9BDJxcx/aFmXMXp2MeGZfHq4IaVe0/+/zLaS7XvO3uufkxgn+EKvcnr1NW1oSf/eLqwrnsyqX2ZZXNvwaN+/YfCPYBAABgbBmZgQvVYnqswRB6GTg7L4SdYx8P6lgVdkweGdprKj7/Yu++1MDpSttNt81Mrrz2ljTX1TWda/Xm6ndSkyardfZ8Qi8DF6pt/6bbZyVXXHNzXguhFbjjx4+X7knw82wdyv05qs4DAAAAo2dMDVzIGPQycML8RX8onU/46ON1ef6HR5aV5sjqk+3Z60jUvWV2Xug+NK9j4BQxb0IvA/dnX/tm3ldkXAyaIPvdQuce1MBJrXsL7XhoXq9cou77E/S1+fMAAADA6BmZgbNa8fTKYF/oZ+A0/1/f+FZeC2JK7LnkCw0efz2do48J7X3o/Kp8UAMnX3Dw564ycHZ1zOPPoT1lUAO3/rON+Xl+9Zvr83E/r+o6Plfpo1x/HgAAABg9IzFwAAAAADA6MHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAycgM3ZcpUPwYAAAAAExAxcOLdvnTBtGl+DAAAAAAmIGLgLph2YfKlaRde6MeGQk6MEEIIIYQ6OnnylLdL0cj5pl345WYNnJwUAAAAALocOnwkOXz4qG9H0biBw7wBAAAAhGnKJ2HgAAAAAMaIo0eP+VYUGDgAAACAloGBAwAAAGgZGDgAAACAloGBAwAAAGgZGDgAAACAljFuBm7vvv3JsWPHUsXyg4uv8K2+fPeHv/ItqMn7H3ycvPr6Gt8eCTE/Y+Hhx57kZw0AAJOWcTNw8uG6/KmVyZInnknz51941U/pS8wH9Ftvv+9b5xynT59Orrz2Vt8eGHkPn3+x/s/LU/Xzs/2qOf2IPQ4AAKANjKuBU06ePJl878eX5/WOnbvTnnL8+Ik0btu+Mzl1qvtrKOw5Dh85kue9atvfv/9AsnHT53ltx6ryz7duT3bt3lMak36INe+s9a1k67Ydhfm6Cnns2PFUOufMmTP5nOPHO/116zemUUyYvB8WeT32enK8vF9yzgMHD+X9g2fzy6+6qbD6+fGnn+W5R/7NGlkxVdTA7T9wMNm+o/jzlmt9+NG6Qi/0XkqUn1/o52T7+jN+9/2PzKwOn5y9Z32/LP4cgv8zpWPvZefVesvn29Io57WvWZD38oMPPy3U8h6L/M8CAABglEwIA3ft9XfmK2PSX/nia8ncBX/ITd0Nt85M++s/25RGMTc6V5B5b771bport989P/lsw+a81rka//Wy6cl1N81IHl/WWQEUZs+/P//Qtvdnj33goaXJ3bPuze9NeqJnnns5ny/Ih7r0P/x4XRrfW/txPn/h4oeTe+97tHD/kr/97gf5+T76eH0a1aBILq9p3sIH0/yhR5cnd96zMD+Hvh49ThBzKvnqt95LH0XeOWNB2pc5Ml/ez3fOXvNHP7sy2bR5a36cRXryOPLlV97Mx+VnJbmsoF5xzS3p8YL8nH7+y2uTV157q/OaM3Nkz6v5p+s2pLlEi+9L/qvf3JCeS49VgyZ/Tn566TXJwt8/Ys4QPof/MyU9udc3Vr+T1/c/uDT57XV3pPmKZ15MTa5e87kXXknfQ3l0rL3lK1amufwc5L0EAAAYK8bVwMkHv3woSq4fpIoaIEGMga5YySrTbXfNS3MZl+OrVo/0ePlg1pUr7WkU5Jwz5/w+zcXYnDh5Mnn9zXeSm26bla7cyAe1PyZ0Hov07Qqa7fvcrj5+8cW+5J45i9N87Qef5NcWs6GEzhF6PWLg9L2yc+wjVDFng+4z0+PFwIlZ9H3/XoT6Vbmlak7ofKG6qmf/TPnx0HVsbntiBPd8sTf92ax6dXXeBwAAGCvG1cCFaokPPvJE+qhKe2Lg1AyJubrljrn5XLsa5gl9+Nre6jXv5bKrRWLiNP/JJVfpoYVj3ljdWfHzr0MZpK+5N3CyyibIo0g1cFdNvy2fEzpH6PWIgZOVOj/X74GTR6mykhW6Z+mJYZGVOh0XA7f4/scKc2zs1a/KLVVzql6ryOOP83+m/LX9fJ/ba8p/bOzZ0zFw/nExAADAWDAhDNzOXXtKH6zWMPQycIIYIFlJ8shj1d/deHflB7IYGUEef86ae1/et+cNHWtz27PII0c1ZnJvdtVQsddRhjFw/vVUGTi/EvXF3n2FcYv25FGu5voIVZCfhz2XrEwJdmUvdF3b91TN0VweJcvP1fctoePsnyl/TGi+zSXq/jdZDdUVOGvg5FGqIPsN9fH9fQ8uKTzKBwAAaIJxNXCqWfM65kmQ1R7pyaZ1/fC8+fbZuYGTjejyAS6EPmg90rePMv0xIvuY8eNP1qf7oAT5ILaPF9WAiHRDfNV1BXl0K+PWfAl6Dr0va+BkD96CxQ+nudzLiqdfSHO9J8G/Bpvb17N5y9bkkcdXFMaVX199c17Lo2zJxeB45B5kTPbt6XzZq/fiy6/n17Oo6ZW9cYo8vpae/Bzt/MeWPFU6XrDz/OtT5DWGrq/YfujPlD+u6jo211XKp7P9jvKzkfdH0bmyx1D/g0L+/IT+4wIAAGAYxs3AAQAAAEAcGDgAAACAloGBAwAAAGgZGDgAAACAloGBAwAAAGgZGDgAAACAloGBAwAAAGgZGDgAAACAloGBAwAAAGgZGDgAAACAlpEbuH/zb/+dH4sCAwcAAAAwWjBwAAAAAC2DR6gAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALSM3cFOmTPVjUWDgAAAAAEaL+C3xbl/68pe/7MeiwMABAAAAjBbxW+LdMHAAAAAALQEDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAAY8SpU6d9KwoMHAAAAMAY0ZRPatzACU3dHAAAAMBk4dDhI8nhw0d9O4qRGDhBTowQQgghhDo6efKUt0vRyPlGYuAAAAAAYDRg4AAAAABaBgYOAAAAoGVg4AAAAABaBgYOAAAAoGWIgbvgwmkYOAAAAIC2gIEDAAAAaBkYOAAAAICWgYEDAAAAaBkYOAAAAICWgYEDAAAAaBkYOAAAAICWgYEDAAAAaBkYOAAAAICWMTIDd+zY8eSJFc8lzz7/sh/K2bV7T/Jf/uTPfTsaPdeRo0fdSLhn+dpf/59k5Yuv+nYt7pl9b3LFNTf7dvLtf7kkvzeNTVyvaap+FlX9ycJkf30AADD5GImBkw9E0aWXT0++9+NfpfnRY8fSsZlzFyff+f6lab59x87GPjxvu2tu8rNfXJ3mcs7tO3YVxvtd58++9s2eZnMQ7pgxP/nVb64v9A4cOFi49rMrV6Wxies1TdV7VNVvM/Y13XzH7OTnv/qtGQUAAJjYjMzAWZ5+7qXCCpRKDdxtd89N4xXX3JQf83f/+MN8niL5siefLZ1fx2xeZeAkfvjxutK5raF6+921pXFBVs2k99+/8vW8t+i+R/K5IQOnY/b6gr3emrffz+d8dPbe/LHzF/0h71l0/N77H0nrU6dOpfV1N91duvcdO3fn86ffeFfe/1/f+Fbae+2NNYVjxGRL/cBDS0rnEs6cOZOf7721H/nhFB1f8cwLee8r//Nv876dt21758+CrGDqNXWOvi7b01zu255HdOc9Cwq9y668IY233z2vMM/fAwAAQFto3MCtXvNe8MNQe9/94S9S8/LgI8tyAyeGSFZBdI6ajaXLn0k/8MVk6DlE1988Iz+v4j+Mexk4kZqcf/j2j9O+NVTS/9fLrk17etzBg4fS/PFlT6dx67Yd+Vx5RCqrf5J7Ayf3Kv3fP/BYPl/w17vptpnJ9bd05grXXn9Hmj9jzK9F3jP7OgRrdKxJE3Tu3bMW5fP3Z6uDt945Jz9OOJ2Zs6t/d1uhb5GevG5ZZQ2N6/1dNf3WfFweGUv+h4eXpuNqhPUa8h5ovmDxQ2lcv2FT/rquue72wlz5s6TnvmfO4jSX99nej+RyHX0/BZ2jPxOdBwAA0BYaN3BVKzba6/UIVXOJMiaPH+0jyNB5FX+eXgZO7sH31VA9/8IrpXN5fvjTX6crRes/21gYF6PpDdwHH34SPJ9eb+VLHVNjX6usRukK5IkTJ/JjLfacf/3N76X3o0anF8ePH8/niLGRFU1F+2LKrrz2llI/xKHDh0vjz72wqtQTfE/r0PsjyIrsjbfOLLyuvXv3B+dL1PdQHtuL+bTjvfJQDQAAMJFp3MDt238g+GGovUENnJgAKzsewp/npVWvm9HiueXLFbZ/8uSp3FA9umRF6VzCXTMXprmsHom5EsOkK0rKTy65sraBe+TxJwuvVwyVvIeCPE6VsdDrtj0xXD/6+RU9DZz0ZTXQPoKW+M57HxTmCN/4u+8m8xY+UOpbpCev1z4eVx5b+lSpJ/ievQ/fE2T1rmTg9lUbOPseymNwO94rD9UAAAATmcYNnCAfht+/+LJCPWP2ojRffP+j+YdllYHTx5GCXTHq9SFrx/wqoD7OEyRqLqZHc/9IU5BVPM3lHLpHT3r6bVPJxWBoXtfA2Z7mYiglvvzqm6VxRXpinjSXlbB+Bs7nC7PHlIKYNs3fe//DPJfXGTqn9ux7ZJHeE092jLKOy+NwfWy66uxr037o3oS6Bk6/xCLXePix5YXxXnmoBgAAmMiMxMAJdrO6fpD7sZ27OnvdFJuLWdLjQ+MeGTtypPtPhcxZcH9+vHz5wM4LfYlBHn/K41Nhy+fbSuOC9mSTvJgLQUyW9mV/2eVX3Vg4RlfRFM3t9TZt3pqfw27KV+P55NMr855Fj1Gj18vA2T1/do6a5Y2bthT6uh/Nf7lBeevtzl5H+adTQuOC3t/aDz7Je2LstW/nhXLZt3bT7bMKr0v37Sk21y+ZyGppaNzmup9O0C9kAAAAtIWRGbixRv6dt0E+hGWOGDgARYyy/McEAABAW5g0Bg4AAADgXEEMnHg3DBwAAABAS8DAAQAAALQMDBwAAABAy8DAAQAAALSMkRi4xesfTP7m+X9CCCGEEEKZvvfKz7xliqZxA6c3eecHs5PPDm70wwAAAADnFIdOHk59kXokWegalkYNnNzUJW9c4dsAAAAAcJbPDm5qxMQ1ZuDUVQpPbXor+erSK5NXtn/oZgEAAACcW+w+eiD1RSJBTdwwNGrghM8P7U6WbSj+InkAAAAASHITN+yeuEYM3MMbl+YGTm8MAAAAAIqoT9I9cbE0YuD+8aXvY+AAAAAA+iCPUwX5YsO4Gzi7/w0DBwAAANAfDBwAAABAy8DAAQAAALSM1hm4P57yH30LAAAA4JwCAwcAAADQMlpr4Lbv2JV894e/Kg4avvfjy5Orpt/m22lf+PXVNwePl9669c38Gq/Q+c9F5L2efsNdvl1A3quxfr/G+noAAABN0VoD95NLrur5AdzPwJ05cyb58ON1aX7ltbcmp0+fTvN9+ztf0W2CXvc3ERnV/cp73Y9RXdtjr/PBh592BwAAAFpEaw2cfBCLMfjppdfkY4ePHEn7YtKsgfN9YeWLr6W9AwcO5qs/H3/6WfKjn3Xv4dElT+VjavDkeD2fnXvg4KF8rlJlSnTeu+9/lPf0Wj+4uPv7YKX+7XV3pPGRx1ckz7/wapo/8NDSdFzuZb+5f3k/JOprFDZt3pqPHzt2PD/vxk2fp/GKa27JeyrF15ZDhw6XxiV/+LEnS8fIe73mnbX5nMX3P5bGZU8+l/fsuarO/fa7H+Q9ibPm3pdGmX/p5delub5GQf5spPPm3ZcfY89rz6/H3zVzUd6T2t8rAADARKCVBu6LvfuS3914d1r7D3mbq4HzfeH5FztmSLArcGrK1OAomos50mvbVcDQXNtTpCf3r7lgr7X+s03B4yV/Y/W7hb7cyz1zFqf5wsUP5/3rbpqRmlE71+YSHztrGKvGe+Whnj1vaK6812+9/X6ay7h//TZ/8ukXgn2J9z+4tNA/evRYYY7N5y74Q/L6m29XjttcTPNjS59Oc/mZal51rwAAAONNKw2cfJjKKphIVllkFU3wH87DGDg578mTJ9Nc0Ll2dUtW0LS/d9/+5Je/vj6ttRf60A/1qq4Vum+b23v54ot9ybyFD6b5hx+tS5avWJmsenV1OlcMiih0XjFFn2/dXurr6tXC3z+S9xQxNfKeKfa8Dz26PO8r3sApoVxi1bktoWN9Lq/Nvm4/3u/cobkAAAATgdYauFdeeytX1QfuMAZOjpWVMUXnVhm40DVCH/qhXtW1Que0eT8DJ3u8br97fj5HseeqMnCKnMP35b2y17b324SBqzq3JXSszSXKY21BHo/6cZtXnTs0FwAAYCLQSgPnV4XsB+7ds+5NbrtrXppbA2f7gjVw8xc9lK7UHD58pLCvTcZlT9SM2ffmc3sZuPc/+DiNIQOgzFnwQHqtZ557uWQQXlr1Rnr+5U+tzHt23Of9DJwgc2V/na7GaU+xBu5fL5uemx2Z8/TZe3zq2ZeCr0N68tj2hltnFs47rIHTfXyhc1tCx9pcHoXKo255H/z4y6+8WZirj7Bff/OdNOqXLvxxwuo17wVzibt27+lMBgAAGDGtNHC92LZ9p2+lVPWV48dP+FaKfCtVHo8OwmcbNvtWEFnB2rFjl28nGzZuGegbm3XZum1HsnPXYObiyJGjeS6Gttf97N7zRfoFglHQxLmPHz9eeDStHMxW5jyy/xAAAKANTDoDBwAAADDZwcABAAAAtIzWGTgAAACAcx0MHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLGNbA/Zt/++8wcAAAAABjCQYOAAAAoGVg4AAAAABaBgYOAAAAoGUMa+D4EgMAAADAGIOBAwAAAGgZGDgAAACAloGBAwAAAGgZGDgAAACAloGBAwAAAGgZGDgAAACAloGBAwAAAGgZGDgAAACAloGBAwAAAGgZGDgAAACAloGBAwAAAGgZGDgAAACAloGBAwAAAGgZGDgAAACAloGBAwAAAGgZGDgAAACAltGIgZsyZaofGxgMHAAAAEA9hjVw4t1YgQMAAAAYQ4Y1cDxCBQAAABhjMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALWPcDdxPX78MAwcAAADQh1e2f5jGzw5uHH8D9+G+T/KbuGnNw24UAAAAAARd6Pr2Sz8cfwMnyE0s3bwizeXmdh894GYAAAAAnJuIL7JPKcU3bT+yw8yoR2MG7h9f+n7BScpNIoQQQgihjrYc2p16pEveuGKo1TehMQMn2C8zAAAAAECRprxSowZO0JU4hBBCCCFUVhM0buCUhzcuzb+dihBCCCF0rkoWt8QXNcnIDBwAAAAAjAYMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtAwMHAAAAEDLwMABAAAAtIxWG7hTp0+lGiVNnv/06dONnk+Rc545c8a3c3Yd2JscOHI4zb95+2XJwaOdvN9x/RiL9x8AAADKNG7gZqz4Q/KfLv56UP3w83+5+PbC+AsfrE6lDHreWPz5Jd+5/wszozynF//j198eeG4d5Jw3L1nk2yl6f3LtBSuXpLmYOB17YNUKd8TgnD5r/uQcx0+e8EMAAAAwQiaMgfNzrfHwc6rqppFzWxMpdZsMnKyOydi2vbvy3v3GsMnYMAZOqPP6AQAAoBkaN3Ah5AP+tid+79s5H2/dmM65eP4Nhb41B9c+PDuvJffjf3/rL5OvXPmd0mrQLxbflvzXX/xD8i8zf1voyzm2frEz+dHc6womUZGVPm9MpO5l4I6dOJ7fm8SvXveT5MjxY/lcb+Dk8aXct/TXbl6X95VrHpyZ3vvyNS/7oXQV7dJFt6a5nNMbuE27t6fvp75fD77ydLL5bE9yXcWUMWvgHnv9+bT39Rt+mpw8VXw0Ove5R9Ox+c8/Xuj/1U2XlN4nAAAAGC0jN3DW4FRRNeey++5M+5csvDmfY+f6nj+P7/ca84T6UvcycPsOHyydV7Rj35503Bo4MVh+nr2e7/cb8wbu1U/eLYz/8z1XJ699+l6a37L03vw8auD8+URirO2YmE3NlQ07txZqAAAAGD1jYuDuXvGAbxfwpkCxJkfw87T+8PPP0lo26kstq3D6KNci9d/ccmmey4pdFf5a2hvEwNnVPjtuDZw//59d8720fujVp/OeYuf+xfQfFo57/dP309obOGH99i2Fuf0MnF0FtNeUOP2ROfmYR8bf3fiJbwMAAMCIGKmB8yaliqp5K9e+mfZl5Ufw83ytvarVLTtf4ur1HxSOtVSdexADVzXey8B9sm1TWotBE+Qxpr3nquO0N4yBe2/Tp6Vrha6p0sfEivT8o1UAAAAYHSMzcLo36p6nHvRDJXR/29ET3f1ighoGMSK29uMWqcXAqQGqQsZiDNyNjy8o9XSeGji5fmi8l4G77+Xlaf2Tedfnq3GHjh5Jx2QfXNVx2hvGwO0PGM8Qb332YX79RS8szftS93ovAQAAoFlGZuCqjIZ8aSCEzn8nexSnZseeQ+svDu0v1BapxUCJGZT8OzOuSvtihqT+/qxr83m9TEfVuUUvrF2df8NT9Ojrz6Xjdg/c9r27c2Oqq2rWwKkpW/PZR+kjXz1Ovthgc/2nOvS4p955Jc3F5J04dTIfG8bAaW7n2lqi7EcUrnloVlrrKtyeg/vTWu4TAAAAxoaRGDjZWyYf6rOffaTQ9ybBo+Mq+RanRR5femPhzye1roDdtGRh6Zx2Xi8D9/Brz5bObc2V6v+74/J8XA3cp9njUH9N/y1Uf66FK4urWiq7AufHfn3/XWkc1sCFvoCh6JdJQmM/mD29UAMAAMDoGYmBq2LtlvW+VUL+yYxbl92bbNq1zQ/l6KPFQZC5L3+4Jtl9YK8f6osYk/U7Oo9vLWLuxARt2bOj0Ld74OS3LgyysV/M3mufvOvbKW9v+Mi3cuTbn/uPHPLtoZF9h/qlEI/9R5QVb+gAAABg9IypgWsbdc1J6EsMkx15vfLv6QEAAMDYgYHrQ+gf0a1C9sXVmd92nnn3tXPq9QIAAEwUMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAyMHAAAAAALQMDBwAAANAycgM3ZcpUPwYAAAAAExAxcOLdvnTBtGl+DAAAAAAmIGLgpk27MPnStAsv9GNRPLH/HYQQQgghVKEmSA3chV9uzsABAAAAwGjBwAEAAAC0DAwcAAAAQMvAwAEAAAC0DAwcAAAAQMvAwAEAAAC0DAwcAAAAQMvAwAEAAAC0DAwcAAAAQMvAwAEAAAC0DAwcAAAAQMsYmYHbsXNP8s77H6f5ocNH0lxrQWvtDVvbnq+rjqlb256vq47x9boNmytreZ/sMb6uOqevh7mGr2OuoVSd09cT6Rr65zZ0DRnrVVddw5/T1/YYf05fx17D1v6cvq66hq8nyzX830+2lj8f9hhfV53T11yj+py+tj1fVx1Tt7Y9X1cdU7e2PV9XHVO3tr1+ddU5+tW216+uOof/e9bX9hj/d7ev23oN/fupSUZi4PSGP/pkgx8CAAAAOOfQ/wBtipEYOGHbjt2+BQAAAHBOIr6oydW4xg1ck+4SAAAAYLKwd9+BxnySGLgLxcD9+//wR34sCrmxg4cO+zYAAAAANIQYuD/64z9OvvR//VFzBg4AAAAAyjTlkzoG7ryzBu6siwMAAACA0dGkgftjMXD/4ez/NEFTm/MAAAAAJhuNGrjzzk++9EfnNWPgmroxAAAAAAiTGrjzUwN3vh+LAgMHAAAAEKYpn9QxcFOaM3A8QgUAAAAI07yBO78ZAwcAAAAAYRo3cPIctQmaujEAAAAACCMG7rwpYuDO/k8TYOAAAAAAwjS11UwM3PlTpjZn4Jq6MQAAAIDJRlMLXamBm3rWwJ131sUBAAAAwOho1sBd0JyBa+rGAAAAACAMBg4AAABgjGhqq5kYuCkYOAAAAIDR05RPatzAAQAAAECYxg2cPEdtgqZuDABgWFa//UEyc/6DqQAAJgKNPkK9YBoGDgAmF9a8YeIAYLKBgQOASUfIvGHiAGAi0JRPatzAAQCMJ96sSVz50hulPgDAeNCkgZuaGrgLmjFwTd0YAEBdQiZNDVzVOADAWNLkHrip0xpcgcPAAcB4ETJn1sBp7ecAALSNroFjBQ4AJiHewAEAjCdN+SRj4Kb5MQCA1oOBA4CJRLMG7sLmVuCaerYLANAEGDgAmEg0a+CmJV+Sr6I2QVM3BgDQBBg4AJiMmBU4DBwATD4wcAAwkWjKJ+UGrqkVOACAsUL/wd5e9DNwfCsVAMaSxg1cUytwhw4f8S0AgJGw9MmVfc3Xy6+t8a0CGDgAGEsaN3BNrcA1dWMAAP0YxMD1AwMHAG0EAwcArQUDBwBtoymf1LiBW7dhs28BAIwEDBwAtI0Ja+AAAMaKbdt35QZMzFyMMHAAMJZMWAPX1I0BAAyCNWGxAgBoGxg4AAAAgDGiqd9YJQbugiYNHHvgAAAAAMI0tdDV+AocAAAAAISZsAauqRsDAAAAgDAYOAAAAIAxYsLugcPAAQAAAIRpyic1vgIHAAAAAGEmrIFr6sYAAAAAJhs8QgUAAAA4R2EFDgAAAGCMaMonNW7gAKA9nDlzxrcgkuMnTvjWyODnBtBeJqyBa+rGAGB4/p+v/kNBtq/x6LFjed9jjwnxl3/7Hd9qjH7XHoSYc1Qdo/1/+t4lyfsfdP6e+8bf/3NpvAlC51rxzAvJV//6n5IdO3fnP7dDhw4H5wLAxIU9cADQE/mwX7C4+IvarXETjh4tmrdPPv0sOXnyZF5bc3DwrFk4ffp0XsuxMi59y8uvvFGoFTEbJ050z63HafTH2WvLtda8874Z7bBu/cbSatSn6zckH378aZpXmZv31n7kW+n55Vz+GN/XlTZ5L+zrD70PW7ftyGsdX73mvbyn+Nfh70H43k8uy38G+nPzBu7wkSPB17bqtdW+BQAthxU4gElKyAToh7uOiclTvvODS9O+6N77HynMe3zZU8lffONb+Vzhr775vXy+8PyLr+R16NrSu+a62wu1xtBxmstKU9W4av2GTWlv/r0P5r1v/cvPK+9DpaZK3ofQNUL9X199U2qcnl35cqFvj7PHLH/q+bwn76G/hp2rr8OOCxs3bcnnyHX152YNnJhjnaMro7pa568JAONHUz6pcQMHABODXh/YOqZGwJsdeUyo8558emXhUaHFHiO5riLJSt7ffetH+ZiOVxk45dLLp5f6dvznv/pt8HWF5qqh7MWf/+X/TqN/Hb1yNXBV4/Je2lWw0L394KeXJ/v2H8hrJTRX+cm/XpnnIQMXuheJ3ngDwPjSpIFr9BHqocNHfAsAxoGQCVB0TI2A1JdffaOdkvdFO3bu8kMpIdPQq+5n4Pbt21/q2/Hde74o9K383FAtK27+uA2btqSmTNFjqvr9DJy/Zqh/18yFyWcbNud9Kz9XGcTAWa37bGPa/+HPfl04NwCML00auEZX4Jq6MQAYDnmMNnPu4kLPGwQ1ArIiZD/g7QqcjR7bl1z3yL37/ofJ//7OxfmYIKtddlUudO4f/fw3pb4dVzMij1VDXyCwc5946vnSfdt61+6iGVT65f0M3Hd/9Ivk9TffLvXtXDVwg7wOZRADp4jRFcQQnzrV+Zk8smRFcsudc/I5ANBuMHAAkxj5ULfSD3P9sLd74C6+9Kp83kOPPlGYp5v4jx07ns8XdI+Y8PrqtwvX8uiXHvycUE/7wqlTpyrHRbqvTJD71r4YHjtfsPvWxKTquJio0DVCfWvgHnh4ad63x9ljXnz59dJ4aAXOvg47V+ln4OweOO0998KqUg8AxpemfFLjBg4AoA4YCwA4l2jSwLEHDgDGDTbZA8C5RJMGrtEVuKZuDAAAAADCYOAAAAAAxogmfxNDowZuXbYxFwAAAACKNLXQ1biBAwAAAIAwTRq4Cy5s0MA1dWMAMLHYf+BQMnN+8Xer1uGLvfvT45csfz4/z+NPdH7NVD9k/txFnV/v1TT7Dxz0rZEz6DVXvd799+QAACyNr8Bh4AAmJx3ztdK3C7/gvhePLn02efjxpwu9QQ3c7AUPFWr9Ze4W+w14e08nTp7Mc+HwkaOF+g+PrijUSugb9afNL5yvwp9f8Pfrr+mP0fvHwAFMPprcA9foPyPCHjiAyYmums1a0F2Fk57847469tSzq/Lfh+pX6x567KnUuMg/zKsGRg3c+g1bkvsfXp58un5T6Tg5v1xTjNi9DyxNxw8c7K4GSlzw+8fSFb4XXn4znav3JKbx3bP/USnX1rnyO0j1Ncg8ua41fJLLap99XR9/uiG99jpzf4v/sDR5+dW3ktdXv5fMWfRw2pMx+XVdOmfj5q1pLgZOe/6a/hh5LWLc5Lz+vQCA9tPUQlfjK3AAMPkQM6GrSNZULH2ysyL38qtr8p6ulr2w6s28J9gVOG/gUrO17NlUIdOi57Rjz73wWqknBk6xq3bWUOk1jh8/kfb8apjw0SefJctWvJAfF7on33v1jXdKr0GuJxLk/Vv70bo012uGjrHnDa14AkC7adLAsQcOAHoipkJ+d6joxVWrk63bO7/cfvnTL6Vx1WvdR30yd969j+a10s/A9SJk4PRcgxo4MWWywie8uWZtpYGTVUR9pPnIkmfSaK+hv0bL9mQFTVYRj7hHpWLeVp+9lrB5y7Zk9569aa7XDB1jz7vo/iVmBACgS+MrcBg4gMmHN1hqjkIGzq5cWXoZuDXvfpiOye/zDB2r15u/+LF03M4b1MBt3bYz/QLF3n0H0loNnL+evBZZcZT9bjr2/oefJvc9tDzZ88W+vLfwviXJ6rfXpqZwzsLuI1Qb9RGqPFa21wnlGuXxrfw9Ktf09wYAoGDgAKBRZK/a08+/6tsDceDAId8Ksnfvft8aCDFSg3zp4uTJU6V7kWP9atnxEydKX2ywG5TFwMlqnq68VeE3NR882FnlA4DJR1M+qfFHqABw7mI360PXwAEAKE0aOFbgAAAAAMYAv+IeS+P/jAgGDgAAAGC0sAIHAAAAMEY05ZPYAwcAAAAwRjRp4FiBAwAAABgDGt0D1+QKHAYOAAAAYLSwAgcAAAAwRjTlkxo3cAAAAAAQpkkD1+gj1EOHj/gWAAAAACRNGridza7ANXVjAAAAABBGDFy6Anc+Bg4AAABgpDTlkzorcNOaW4EDAAAAgDBNGjj2wAEAAACMAY0auKb3wJ08edK3AQAAAKAhGv8Wqhi4bTt2+zYAAADAOc+E/U0MTd0YAAAAwGTio082NPgIdVezj1CVpm4QAAAAoO3IAleT3qjxFThFblLVRG17vq46pm5te76uOqZubXu+rjqmbm17vq46xtfrNmyurPWLKoPWE/UaStU5fT2e19D/41fV9hhdBa+qY69ha39OX4/nNXw90a4hfz5C5+hXy5+Vqtqf09dV5/Q116g+p69tz9dVx9Stbc/XVcfUrW2vX111jn617fWrq87Rr7Y9Xw/696z/u9vX9hh/Tl9XXaNJRrYCpwz6ovrVtufrqmPq1rbn66pj6ta25+uqY+rWtufrqmN87f/g2tr/TPvVE/UaStU5fT2e1+hlEBStvWHwdew1epkSX4/nNXw90a4RaxjGwpRwjepz+tr2fF11TN3a9nxddUzd2vb61VXn6FfbXr+66hz9atvz9aB/z/q/u31tj/Hn9LW9hv4Za5qRrcABAAAAwGgY+QocAAAAADQLK3AAAAAALYMVOAAAAICWgYEDAAAAaBk8QgUAAABoGazAAQAAALQMVuAAAAAAWgYrcAAAAAAtgxU4AAAAgJbBChwAAABAy2AFDgAAAKBlYOAAAAAAWgaPUAEAAABaBitwAAAAAC2DFTgAAACAltH4CpycECGEEEIIhdUEcp5GDRwAAAAAjBYMHAAAAEDLSA0ce+AAAAAA2gMrcAAAAAAtAwMHAAAA0DJ4hAoAAADQMliBAwAAAGgZGDgAAACAloGBAwAAAGgZ7IEDAAAAaBli4KZOm4aBAwAAAGgLPEIFAAAAaBkYOAAAAICWgYEDAAAAaBkYOAAAAICWMWYG7syZMwghhBBC54xGycgMnH8RCCGEEELnupqicQMnN7di4+rkq0uvTHVRFov1VVktsauLetThsatT2bxTd/N+6s69JsuvGUgXlXq/DcSOLqrIw7o2j525UvfXRaXe9ECM0e8CMUbXBWKMrjfR53V0g8tjdWMmm8fqJhOH0c0mxuiWblyidUBLetRpfmtW32pqybNYVZfGbivGPL+tOoZ6S2/vxjTvE0O9NN7RiXl+R3UM9fJ4Z0eaL9HaxFDPxzS/y8S7ijHU83Hp3Vlu493daPOqmOYzAnFGJ9rcxpCW3pPlWUzrTDb3dWlsZpZnMa0z2byvZgVijGa7PFZzMtm8juYGcol1NS+TzetofiCXWFcLMtk8VgtNjNGiQOzqL5fe25iJa8zAqbPccnB3kpqzZVd1pLmYrFAM9WxMczFWGq8uxlDPxjQXQ6XmTOsK+TFbL3MmLa0z2TxUV5i0zlxvvgaVGCofYySGyscYiZnSOIzUWNk8VmKsNMZIDJWPw0iMlcYYiaHyMUZiqHyMkZgpGzWvKzFWGoeRmCqbxyozWoU8VmKsNMZIDJWPMRJD5WOMxFD5GCMxVD7GSMyYxmE0y+Wxmp3J5nU0J5BLrKu5mWxuJKYrlOf1vHIuUUxWWgfkx/I6M2cSVWK2NNo8FPNcjJXGBcUY6tmY5mKofFzYjTYPxTxfFIiZNK+KYuKWdUzcsEauEQNnlwYLps2bsVAs9cRomVhl3PoaODFaWVQTVhVDvTyK0XK5mjMbQ71CvLaj3LBp1L7LQ7HUE7OlcXon2jwUC73MsGksGbLfZWMVdWlMDJfk12W5ka+DY2K0rGmzeaZl3qCFJEbL596YDSI1XZrbXl2J2fIxRmK2fIyRGC2Nw8gauBiJ0fJxGInhsnldidFqwsCJ0bJ5XYnB8rk3ZINITZfmtldXYrJ8jNGwhk0lRktjjMRg+RgjMVg+xsiaNY0xEqOlMV5fy02b5oMpPFdMl8auvlaRe30tNWiZccvrrmzde0zMVmbc8jqswtgSqReV88yUdWqXV9SdvGvghjFxQxs4/2zXPzblESqPUHNTV4oxEjOm0ed1pMZO81ipQbN5rMSQaRxGDZo7HqEG4h2dyCPUwJwZgWjMG49QXR6rOZlsXkdzA7nEupqXyeZ1JCtrPpdYVwsy2TxWYtI0xmhRIJblvVMMQxk4fwOnT59OvrrsyoRHqIG6wqR15nrzNajEUPkYIzFUPsZIzJTGYaTGyuaxEmOlMUZiqHwcRmKsNMZIDJWPMRJD5WOMxEzZqHldibHSOIzEVNk8VpnRKuSxEmOlMUZiqHyMkRgqH2MkhsrHGImh8jFGYsY0DqNZLo/V7Ew2r6M5gVxiXc3NZHMjMV2hPK/nlXOJYrJKK2yZ/FheZ+bMrqyJ2dJo81DMczFWGhcUY6hnY5qLofJxYTfaPBTzfFEgZrIrbaGY5adOnSp5qLo0ZuDEvMkN+VU3zcPxqlSa6yqbjaFeN4op6+bd2DFudiXO92ws9rorcbrKJtHmoVjuyWpbMXby6hjqiTGzK3G60lYVQ71OnJ7Gbt4xb6EY6nVjx6xpflFeF2OoZ2Mnv87EjnnTGOr5KMask9vYMW4SbV6IS8ycNL8hG7vB1F0Tp/lFS8J1N78xG7vR1JJ3zJvknbFiLPduKsVOXh1DPTFmNl6UrqZJHo6hXifeksdU2UrbRYHoe8W5HbOm+UXZypvGwkqcG7Oxk9+WR11lu8hEm9uYr8iJMctW4zpjUnfM20VmBS7P/dgSze/Ixu4wdUcX6Qqc5n4sqzv5ndnYnaaWPDNx2UpbsC6M3ZXVd2VjUkveiVV1eezurL77bC15Rzb3dXhsRlZL7OqiHnVx7J6svqeUd+pu7lUcm2liWRdV5KEVuO645NIfTJ25s10eqzmZbB4rMWkaYyRGzccYiUnzMUZi1nyMkZg1H2Mkpk1jV+KXxDeNi4HzzlFu5OTJk0ln5ezKTvSraaFY6nVMWR7zXFbOAjHUK0RdRctyMVM+hnqN74GzuZgojdd2o81D0a/UDbIHThXaA5fXYqIk9ytqv8vGKurSmJgoya/L8ljp6pnNYyVGSmOMxED5GCMxUj7GSIyUjzESE+VjjMRE+RgjMVEah5GYKJvHSlfPbF5HYqZ8npmv2pLVMh9jJKtlGoeRrJZpjJGslmkcRjNNjJGskPkYo9mBGKM5gRijuSYOo3kuH0bzTYzRgkDMJOYqlPs6zRdmtRgqrTOJyQrlvk7zRVm9KDVjpT1wfuXNjGtP/NKwJi7KwIXMW27gzOpbtcSYaRxGmUkr5LESk6YxRmLOfIyRmDMfYySGzMcYiSHzMUZixnyMkZgxjcNIzJjNY6UGzeZ1JUbMxxiJEfMxRmLEfKwpvwcujwENsgdOzV1eS+7Mm62DY2LGNBoF97lV9Oyqm11xq4qhXh4zg2ZW3Eox1PPRrrylMTNsGkM9H8WQpbmNmWHTVTXf8zHNZwSiMW+ah2Khd08gZrK5rdXYFcZmZrnEzLiFcl+XxmZluUSndKyizvPZJvq8juaYGKO5LmpeV/NMHEbzXR6rzKAV8liJSdMYo0WBWNaJEydSz6T+KcbEDW3grHmTG/rqsiuT4gpclovJ8tHnVXNSYyU9Z7oK+9x6jYmhUnOmdYX8WK89cCXzNajEUPkYIzFUPsZIDJWNmteVN2c2ryM1VprbXl2JsfIxRmKsNA4jMVYah5EYK40+ryMxVhpjJIbKRs3rSoyVMWeFvI7EVPncGLKBlRmtQh4rMVYaYySGyscYiaHyMUZiqHyMkRgsH2MkBkvjMBLDZfNYzc5k85oSk5bmYrCyqBLTFcpDdbp6lsV0TOpMYsBCua3VsMnqmY9WYsCqYqEnBkvj/G60eSiWemKwNC7oRJuHYqEnxkrjwm60eSjaFbhSzGRX3kIxy48fP15p4AY1cbUNnL+I7n3LDVy+v62jqr1vxT1w1THU60YxZU3tgbN73zR2jNvwe+C65i28zy20B667921i7IHr7nuzeWh/W3dOdRx+D1zHoPk9cN1+Ofexm3fNXb4Xzpi30J638JzyHrhOXjRxvi6PiRnrxNAeuFAdHjtrzOxeOL/nzdeVY7dkdWbQeu1z6zWWmbU8H2AP3I1vLTd1tu+tzx44qf2et2KdmbRR7oFLa5f7sczglffAZcbNr8CFxrzEmKV5tpctrYt5Llvnuexd60StSxLT5nslzTBxGN1jYoxmBmKMZrmoeV2JObN5rDKzVshjJSZNY4wyU1eIMRJz5mOMMnNXiDESs6YxRmLWfOzq2LFjqWfSx6jexA3CUAZOLyo3IDcijrL8uDQkMVoah5EaNJvHSsyWxhiJyfIxRmKwfIyRGCwfYyQGy8cYicHyMUZisDQOIzVtmsdKzZfN66pr2LoxRmKyfIyRGCwf68my4cDurG8MmlXFI9SFH76cHt9ZRVOzlkVjzoJ1cEwMlsbbC/eYXsc/LrU5j1DLPR/TXMyWjzM60eahWOiJ2fIxk81trStyhTExWpJnpiutA7mvS2Nq3Lwhm5WNVdR5LkbLmjab15EYLY0xEoNlo+Z1JQZrGLOmEoNl81ip6bJ5rMRsaYzRokAsa2IaOB6hDiAxVD7GSAyVjzESQ2Wj5nXlzZnN60iNlea2V1dirHyMkRgrjcNIjJXGYSTGSqPP6yjepHVNmY2dXFAjduTkiUIdlhgrY84KeVjv7d6SHDpxzPXVpJUNm1fnnsr9jjKjVchjJcZKY4zEUPkYIzFUPsZIDJWPMRKD5WOMxGBpHEZiuGweq9mZbF5TYtLSXAxWFkOPSW0eqnmE2o2FnhgrjQu70eah2OAj1KNHj6aeSfxT7JcZhjZw+vhUbkQcpX1cWn50yiPU0KNTjTxC5RHqZHmEKtixTn1r8rVlt9m/TtKePAr1/ObVR9IxQaNFjFmv+pO9O/LeriMH05iaOfMItdMrPkK1HDhxNJHHosKpM6fTqHUVqVFbckeh98tVDyfymNTCI9RBdY+JMZoZiDGa5aLmdSXmzOaxysxaIY+VmDSNMcpMXSHGSMyZjzHKzF0hxkjMmsYYiVnzsSs1cMN8GzXawNnVt4KBs6tufjUtFEu9jinLY57LylkghnppFPOUxdI/DeJiqJdHMU8u7/lPhFTFazvSPI/ad3kolnpiojRO70T/z4j4WOiJeTLRmK9cpX8qpCJPazFRkl+X5Ua+Do6JebJGzOaZ+FVagRgjMVYah5FdgetKWL7x3eTJs1K0/5fLxDDdmpqiF7d+nHy0d1ua66qb8JvXHs1zG63sCtxn+3clR0+dSMSI/dXyu7L5t6fxqU1r09zLI73/d5mYmduTVdvW5T3hslflfjqGq9OvzoV7P3rN9e9M4zeemJHm/SX34fPMaNVSZrjy3PbqSu7dxxjdY+IwmmlijGYFYoxmB2KM5gRijOaaGC9+lZaplzT/q7SOHDlSMnB1TVyjBk4cZdUKXLEWY6axK11dC9XhsY5Zs7ldXRtE3bndlbdBZFfeOsrMXSF2FFqBq5aYs060K2/9ZFfgOhJD5mOMxJD5GCMxYz7GSMyYRp/XkRo7zWOlBs3msRJDpnEYiTHTGCMxZFm0K29eugIXqAUxcK/vWJ/mMuZX34QjJ48n8tfUM5vFZHXN329eeyTPxaC9tXOjOarTyw3ckvJ5hYLxy1fZyitwdn+bR3t+ju6B6+RlA+fRVTn2wAViSGLM7ApcWmeyua9LYzOzPItpncnmfTUrEGM02+WxmpPJ5nU0N5BLrKt5mWxeR7JC5nOJdaWrZjaPlZg0jTFaFIhliYGTRa8xM3D+8ak1cHIjqYFbdmUy8B64fE6PmOZirDReXYyhno1pLoZKzZnWFfJjvfbA6eqayOahusKkdeZ68zWoxFD5GCMxVD7GSMyUxmGkxsrmsRJjpTFGYqh8HEZirDTGSAyVjzEyJi2PMbIrcN2eYA3ZHe88k+f/8JR8kN6arrL97KX7kgc+eT2fL6ZM8CtwN6TfRu2svGlP5nZW7m5LPt67PTl5+lTSMWe3JXPWvpjmnbnl1bfQ2Imzx8t5JN9z9FA+3ondR562DuXCk5vez/tz1r5kxjPjVUtiqHyMkRgqH2MkhsrHGMmfAx9jJGZM4zCa5fJYzc5k8zqaE8gl1tXcTDY3EtMVyvN6XjmXKCartMKWyY/ldWbO7MqamC2NNg/FPBdjpXFBMYZ6Nqa5GCofF3ajzUMxzxcFYia70haKWX748OHCFxliHqM2b+AqVuDC8apU3X1xWndjqNeNYsqa2gMX2gvXMW7D74FT0+f3ufXaA1feC9fJe8dQr5k9cN29cKLx3wPXMXd+D5zd5+b3vOWRX6UVjKFe7K/SEnTuD1YuzOquoVOklj1wWw/tTeuH172ZxkH2wP3N8rsLtUX+6rNmz/+zItbA6R64bz89Lz9+/f5dadQ9b7oCZ+vimDFzbr+bnEv3wOk3U/lVWtU1v0prEM3JZPNYiUnTGCMxaj7GSEyajzESs+ZjjMSs+RgjMW0au7IGLnYfXKMGTpYEOytnV3aiX00LxVKvY8rymOeychaIoV4hykqZGKgsFzPlY6jX+B44m4uJ0nhtN9o8FP1K3SB74FShPXB5LSZKcr+i9rtsrKIujYmJkvy6LI+Vrp7ZPFZipDTGSAyUjzESI+VjjMRI+RgjMVo+xsivwBX3wg2ie95/Pv37RfIfv7A4y4v73QZXZwWum8dKV9xsXkdipnyema/aktUyH2Mkq2Uah5GslmmMkayWaRxGM02MkayQ+Rij2YEYozmBGKO5Jg6jeS4fRvNNjNGCQMwk5iqU+zrNF2a1GCqtM4nJCuW+TvNFWb0oNWOlPXB+5c2Mh1bgJpCBuzLhEWqgLkgMmInemA0sMV0+xkhMl48xEsOlcRip+bJ5rMR0aYyRmC0fh5GYLo0xErPlY4zEbPkYI2/gNK+nwt8zZ1U2ZoNKDNdEMHBWYro0xsgaN40xEtPlY4ysgdMYIzFfPsZIzJfGYSTmy+axUkNm8zpSA2dzb9IGkZqvCjMnq2WhPK/FcLlcoqyOlQxaJj+W1/Oz3JgyWR3TaPNQzHMxYhqrTFpFVMNWisaY2TwUrYErxUyaV0Vj4OSp5bgbOLmB3MDxCDWLPEL1PR6hZvEceIQa/CdGMrOmuf4Ghl6/icHPkai/gaHqNzFItLmN9hHqSH8Tgz4aDTwy9TWPUHmEWl9zMtk8VmLSNMZIjJqPMRKT5mOMxKz5GCMxaz7GSEybxq6aM3DTGjRw6crZlZ3oV9NCsdTrmLI85rmsnAViqFeIuoqW5WKmfAz1eITaUekxaUWe1mKiJL8uy2Olq2c2j5UYKY0xEgPlY4zESPkYIzFSPsZITJSPMRIT5WOMxERpHEZiomweK109s3kdiZnyeWa+aktWy3yMkayWaRxGslqmMUayWqZxGM00MUayQuZjjGYHYozmBGKM5po4jOa5fBjNNzFGCwIxk5irUO7rNF+Y1WKotM4kJiuU+zrNF2X1otSMxT5CDRk4a+L6MZIVuP4SY6ZxGGUmrZDHSkyaxhiJOfMxRmLOfIyRGDIfYySGzMcYiRnzMUZixjQOIzFjNo+VGjSb15UYMR9jJEbMxxiJEfOxpvIVNx8DqvhVWt0xMWNZbPBXaeVyq2x5DPXsqptdcauKoV4eM4NmVtxKMdTz0a68pTEzbBpDPR/FkKW5jZlh01U13/MxzWcEojFvmodioXdPIGayua3V2BXGZma5xMy4hXJfl8ZmZblEp3Ssos7z2Sb6vI7mmBijuS5qXlfzTBxG810eq8ygFfJYiUnTGKNFgVjWxDRwy65MiitwWS4my0efV81JjZX0nOkq7HPrNSaGSs2Z1hXyY732wJXM16ASQ+VjjMRQ+RgjMVQ2al5X3pzZvI7UWGlue3UlxsrHGImx0jiMxFhpHEZirDT6vI7EWGmMkRgqGzWvKzFWxpwV8joSU+VzY8gGVma0CnmsxFhpjJEYKh9jJIbKxxiJofIxRmKwfIyRGCyNw0gMl81jNTuTzWtKTFqai8HKokpMVygP1enqWRbTMakziQEL5bZWwyarZz5aiQGrioWeGCyN87vR5qFY6onB0rigE20eioWeGCuNC7vR5qFoV+BKMZNdeQvFPitw9R+hDmngCl9iyPe3dVS19624B646hnrdKKasqT1wdu+bxo5xG34PXNe8hfe5hfbAdfe+TYw9cN19bzYP7W/rzqmOw++B6xg0vweu2y/nPnbzrrnL98IZ8xba8xaeU94D18mLJs7X5TExY50Y2gMXqsNjZ42Z3Qvn97z5unLslqzODFqvfW69xjKzluc19sDpylta99kDJ7Xf81asM5M2yj1wae1yP5YZvPIeuMy4+RW40JiXGLM051dpdVfefIzRLBc1rysxZzaPVWbWCnmsxKRpjFFm6goxRmLOfIxRZu4KMUZi1jTGSMyaj1019y3UIffAFX4Tg11186tpoVjqdUzZ8HvgxDxlsbSvzcVQr/E9cNd2pHkete/yUCz1xERpnN6Jfg+cj4WemCcTjfnKVdrnVpGntZgoya/LciNfB8fEPFkjZvNM/CqtQIyRmCiNw0hMlMYYiXnycRiJibJ5XYmZ0ujzOhIzZfO6ElPl88xo1VJmuPLc9upqRiDG6B4Th9FME2M0KxBjNDsQYzQnEGM018R48au0TL2k+V+l1ZyBa2AFTg3cJzs3JaEVuGItxkxjV7q6FqrDYx2zZnO7ujaIunO7K2+DyK68dZSZu0LsKLQCVy0xZ51oV976ya7AdSSGzMcYiSHzMUZixnyMkZgxjT6vIzV2msdKDZrNYyWGTOMwatDc2ZU3L11lC9V+D5xZgSvtefN1aey2YnQrb8EY6okZK6zA9Ymhnl11cytuwRjq5TEzaPkKnNYmhno+2pW3NGbmLd/fFuj5KIYszW3MjJtfeauKaT4jEI1509zGkMSY2RW4tM5kc1+XxmZmeRbTOpPN+2pWIMZotstjNSeTzetobiCXWFfzMtm8jmSFzOcS60pXzWweKzFpGmO0KBCL+ktn4MRHjdzACf0M3KFDh4IGjkeoRQMXijxC5REqj1CLOY9Qi3lpzEuN3BIeoRaMWyHGSAyXjZrXlRgum8dKzZfNYzWMgVPj5mOMrIHTGCMxXz7GSMyXxhhVG7mDBw82+LtQB3yEKlQZOHGRYuDEVe7fvz/5YOv65Bcvnf1hiqkqPSY1sdTrmDIeoQZiqScmSuP0TvSPTH0s9MQ8mWjMV67SY9KKPK3FREl+XZYb+To4JubJGjGbZ+IRaiDGSEyUxmEkJkpjjMQ8+TiMxETZvK7ETGn0eR2JmbJ5XYmp8nlmtGopM1x5bnt1NSMQY3SPicNopokxmhWIMZodiDGaE4gxks9djfHiEaqplwz/CPWbK/6QfPD55tQfyUKX+CVZ+BrWwE1tysDJzYirlJvbt29f8sUXXyS7du1KduzYkWzfvj3ZunVr8vnnnydbtmxJtXnzZoQQQgih1ku9jfgckXge8T7ig/bs2ZP6ogMHDqQ+KfQN1BgDF7UCFzJx+hhVbk6WCMVpqpGTm5cXsXPnztTQqeTFIYQQQgi1VdbXiM8R7d69O/U+e/fuTf2Q+CL950PEL3kDV8e8CdF74EIGzq7CyU3KSpy4TTVy8iLEzKmhQwghhBCaLFKPI35HfI/4H/FB4ofEF+neN2/e4g1c5Aqcmjj9BoWaOLk5XYmTmxbXKVIzp4auSvLCEUIIIYQmmrxn8VLTJhLvIz5IH5uKPwqtvsUbuBorcII3cKFVOLlJa+R0Rc4auirpC0cIIYQQmkjynsVLvY6uuIkPqmPe6hk4WYGbFmfgepk4NXJ68/JC1Mz1kr54hBBCCKGJJO9ZvNTreOPmzVuVgRuU7gpcDQMnVBk4a+JCq3HezCGEEEIITQZZn6Pex5u3JlbfhKhHqIK/YMjEeSNnV+UQQgghhCajrGnzxq0J8ybU/hKDxV/Ymzhr5KyZs7LGDiGEEEKobfLepsq4NWXehOgVOMXfgN5YPzOHEEIIITRZZf2PNW5NmDdhqBU4xd9IyMh5M4cQQgghNFnlPVDIuMWaN2HoFTjF31A/M4cQQgghNNnlPVET5k1oZAXO4m8OIYQQQgh11QSNrcB5/M0ihBBCCJ3raoqof8i3Lv7mEUIIIYTOBY2K6H/It0n8i0UIIYQQaovGg5E9QgUAAACA0TAmj1ABAAAAoDkmxCNUAAAAABgcVuAAAAAAWgZ74AAAAABaBitwAAAAAC2jsAJ3/PjxtGm/Ehv6emyoJ1T1Q9SZOxEY5H51TtXc0PtaZ67Pe/WEqn6IOnPbQr/32NJvbuhnUGeuz3v1hKp+iDpzJwKD3G/Me1xnrs979YSqfog6c9tCv/fY0m9u6GcgMTQ/NNfnvXpCVT9EnbkTgUHuN/bnESI01+e9ekJVP0SduROBQe435j2umrth0+fdX6X19tvv+PEgVScbBXWuNcxcX1v8mK97EfphDMKo5o4lde7Lz/W1xY/5uhexc2OP60educNS51rDzPV1L2Lnxh7Xjzpzx5I69+Xn+trix3zdi9i5scf1o87cYalzrWHm+roXsXNjj+tHnbljSZ378nN9bfFjvu5FnZ+HHX98ybLuI1RZjmuSfjdi6TXXj/na4sd8banzpllGNXci0eu+/ZivLX7M15Y6P486cy2jmjtq6txLr7l+zNcWP+Zry7n286hDr/v2Y762+DFfW+r8POrMtYxq7qipcy+95voxX1t6jXnOtZ9HHXrdtx/ztcWP+doy0X4eOnfNmreT//s//+fuI9R/+s4/J++/vzafIFFl8bX2QnN1zNeDzu3FRJvb77hh51a9b77WXmiujvm6ztwqeo15xmJuv+Oamtur1lzf39Dcqp7v65ivfU+p6oeYaHP7HTfs3Kr32NfaC83VMV/XmVtFrzHPWMztd1wTc0Pvmx/XWDW3quf7OuZr31Oq+iEm2tx+xw07t+o99rX2QnN1zNd15lbRa8wzFnP7HTfo3A8+WpeuvuUrcKI58xYmzz6/sjAx9Cb6WvFzq+YJfszXFj+mte+HenpPvu/HvDx+PKRec30/NNfSr9+vF+qH5ih15/aqLX6s6nXpmEYvjx/3c+0xfjyk0FxLqB/qDdIfBD+313F+zNcWP6a174d6Va/Lj3l5/HhIVXND/V69Qfr9eqF+aI5Sd26v2uLHql6Xjmn08vhxP9ce48dDCs219OuHelX9QfBzex3nx3xt8WNa+77v2ddUNbdKHj8eUtXcUL9Xb5C+74Xwc6vmCX7M1xY/5muLH6t6XTqm0cvjx/1ce4wft3P8+bV+7qw/E/M2ddoF6epbauCmXnDWwJ3V+VMvSP7bn/xpMnvugrOTPk0fq27ZujOV5LbWXlWutY8+D82pMzc0Zmvfi5nrNV5z/fvi5/rx0FwffR6a0/TckPyYvWcv3+8112u85vr3RWsfQ7mf48dD1/HR51Vz/JitfS9mrtd4zfXvi5/rx0NzffR5aE6duaGxqrrXmL1nL9/vNderybn+fYmZ62Mo93P8eOg6Pvq8ao4fs7Xvxcz1Gq+5/n3xc/14aK6PPg/NqTM3NFZV9xqz99xPTc6VLywsfWJF8id/+qeZeeusvk378oVnDVy2Aic6/4ILUp03dWpy3pQpyR9bnX9+PZ3XJ/aaG1KvsUF13nnl3rmuifSeTKR7OX8i3ctEEe/JUJpSkYdq26uKoZ6NoZ6PoV5o7KzOE53fiVrLeNq3PddHHY3PezLFxY469+LHfAz1fPR5qO6t/M/WhJW8Hv+6tReq43S+0XlTz8azPkw05awnE4lXE3VW3y48a+C+fNbAnU3UwKUrcZmJO3/K1MzImSgnPr+G0vnmxflxnVM11rjOD/RqyN+nravG7OuriqFeneOr5vi+z9O6mT98jaixe/HnCdX+/4wuNnYvk0gT6j2ZSPeCxlRTe9Sah2KoN+Dx55s5ee7Hpma5uZav/ZjKH+t7Nlb1QnWV/PXHUxPpXpqRGC/f668pqcSwqXHrSFbd0pW31Lx1V986K3BnDVzBxKVGLjNxVpkbFKWGzps7G0NzqurQWGoWe4xV9Xws5fIHvGIsVJ8L8u/JeIp7aVz2/7fDqvPhUO6Ph5p+ba1S9hd8Kbe1RJtXxVDPn9d8oNho55TGTN9/IPm6NGZyX/uxXqozdyzkX+d4qnMvsrJTHhtrTZz3per96KyAdeXHvfzcUG7r4pypElPTJitundgxbrry1ll9Sw2cNIImzjxSrdTUihiaU1UPOtaE0r90Av1zWRPpPZkg9yL/R+p8uGnux8p5qO41FjpPKIZ6dY9vSp0PxHJ/PDSK19e4plXUEm0eiqGej6FenWv4OaE6y3UVQHPbC0mO871zXRPpPencS9cghKOV7/k6Xv3+LI2dql5/59FlWaG5veYPrs570sn1CwtBA6fmLVX2hQZ9nGpX5KaIubK6wMSQ/NyqsdD5fC9GwWuJ2w/1B5S/R3uNXjHUszHUq3O8zvFzq+rC2MQwTamGuhd7rD+P1jb6ntNQ9zIxJP+/9XkoDqruf7WPvyaSmZw4mkTvybRAr2pMau31iq4nH7al81WM5XXVWCab65jK1nauj6GePU9Ideam89y9jacm0r2EpcbK90ep7uNSK310WnqEWpAaNytr7Ky566decwcZ83MKxjLQ8wrNR12lfxEF+uOhiXQv0ybSvdST/6+5ptT5cCj3x0OjfJ0TThf2qDUPxVDPx1DPXUM+OHpG19Pc1/aDSM4fyvvVfqxN8u9Bc7IrNH7MqzNndPdSXxPnXkLvX2fVq6iqfmjM1vYaodjNO3/Ou3V31a2z8tZdgUv/z2rNm1HVipxX1Vh6vDhsM8fGUapwD+Mge21/H762vVAM9XwM9fy1fC+NxqjYc4XqRuSNkdad/xIr9YIx1PPnDUnmePk5mSaUmawn+f+0jb3G9IN2EE0sAzdx7mXiiPekpAsrcluH5lTFaZ0P9uCYRNdLP4DNMd7s9jze1F1D0YzsvQykUc29cDSvL6g61xnV3F4y59H3pLDilhs5yTtj/z9XLyvyp05mugAAAABJRU5ErkJggg==>
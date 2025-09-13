FEATURE CHANGE REQUEST 
Change Request: Farmer Registration Form Update

1. CURRENT SITUATION
What exists today? The current farmer registration form includes fields grouped under "Farmer Type," "Agricultural Information," “Document Uploads” and it can be done by administrator or bank viewer


What's the problem with the current version? The section headers and field grouping are unclear. "Agricultural Information" is not intuitive for bank viewers and the Administrator needs to be renamed and simplified. Also bank viewers and administrators are not able to calculate service costs unless they add farmers to the system.


2. PROPOSED CHANGES
What should change? 
After clicking the Add Farmer button, the bank viewer and administrator should see two main sections:
Service Cost Calculation
Farmer Details


The specific information to be filled in under each section is provided in the DETAILED REQUIREMENTS.
The Farmer Type field, which is currently present during farmer addition, should be removed.
What should stay the same? 
Irrigation Type field. 
The “Document Uploads” function field can remain unchanged. However, the names of the uploaded documents need to be renamed according to the detailed specifications provided in section 3: DETAILED REQUIREMENTS.
The crop field must remain as a dropdown list. The list should be limited to exactly 15 items. Only the following crops should be displayed in the dropdown:
Walnut
Hazelnut
Almond
Blueberry
Apple
Cherry
Pear
Peach
Nectarine
Plum
Grapes
Pomegranate
Apricot
Raspberry
Blackberry




Why make this change now?
To improve data quality and usability of farmer profiles. 
3. DETAILED REQUIREMENTS
Changes to User Interface:
When a bank viewer or administrator (Telagri) adds a farmer, the system must store the registration date so that the bank and administrator (Telagri) can see when each farmer was added to the database.

Changes to Functionality:

After clicking the Add Farmer button, there are two main sections:

1. Service Cost Calculation

The calculator will display the calculated amount, and after clicking the NEXT button, the user proceeds to fill in the Farm Details information.
Concept
The calculator returns a Service Cost (EUR) as the sum of 7 priced components.


The selected crop determines which tariff table to use for all other fields.


Formula
total =
  crop_base +
  area +
  reservoirs +
  outermost_distance +
  plant_age_groups +
  varieties +
  road_distance
If a chosen option doesn’t exist in the active tariff’s price table, treat it as 0 and (ideally) show a non-blocking warning.

2) Tariffs (which crops belong where)
Tariff T1 (super-intensive set)

 Blueberry, Blackberry, Raspberry, Apple (super-intensive, with support system),

 Pear (super-intensive, with support system), Peach (super-intensive, with support system),

 Cherry (super-intensive, with support system), Plum (super-intensive, with support system),

 Nectarine (super-intensive, with support system), Almond (super-intensive), Grapes


Tariff T2 (semi-intensive/intensive + nuts/stones)

 Almond (semi-intensive and intensive), Hazelnut, Walnut,

 Apple (semi-intensive and intensive), Pear (semi-intensive and intensive),

 Peach (semi-intensive and intensive), Cherry (semi-intensive and intensive),

 Plum (semi-intensive and intensive), Nectarine (semi-intensive and intensive),

 Pomegranate, Apricot


Both tariffs have crop_base = €500.

3) Pricing Tables
3.1 T1 (Super-intensive set)
Area → €
0–5 ha: 200


6–10 ha: 400


11–15 ha: 600


16–20 ha: 800


21–30 ha: 1,000


31–40 ha: 1,200


41–50 ha: 1,400


51–70 ha: 1,600


71–100 ha: 1,800


101–150 ha: 2,000


151–200 ha: 2,200


201–300 ha: 2,400


301–500 ha: 2,600


Over 500 hectares: 2,800


Number of reservoirs → €
0–1: 500


2: 1,000


3: 1,500


4: 2,000


5: 2,500


6 or more: 5,000


Longest distance between two outermost plots → €
Less than 100 m.: 100


100–300 m.: 250


300 m – 1 km: 500


1–3 km: 1,000


More than 3 km: 3,000


Number of different plant ages cultivated → €
1: 200 … 9: 1,800


More than 10: 2,000


Number of varieties cultivated → €
1: 200 … 9: 1,800


More than 10: 2,000


Approx. distance from nearest sector to asphalt road → €
Up to 1 km: 50


1–3 km: 100


3–10 km: 200


More than 10 km: 300



3.2 T2 (Semi-intensive/intensive + nuts/stones)
Area → €
0–5 ha: 100


6–10 ha: 200


11–15 ha: 300


16–20 ha: 400


21–30 ha: 500


31–40 ha: 600


41–50 ha: 700


51–70 ha: 800


71–100 ha: 900


101–150 ha: 1,000


151–200 ha: 1,100


201–300 ha: 1,200


301–500 ha: 1,300


500 ha: 1,400


Number of reservoirs → €
0–1: 500


2: 1,000


3: 1,500


4: 2,000


5: 2,500

 (no “6 or more” for T2; if selected, price=0 unless you add it)


Longest distance between two outermost plots → €
Less than 100 m: 100


100–300 m: 250


300 m – 1 km: 500


1 km – 3 km: 1,000


More than 3 km: 3,000


Number of different plant ages cultivated → €
1: 100 … 9: 900


More than 10: 1,000


Number of varieties cultivated → €
1: 100 … 9: 900


More than 10: 1,000


Approx. distance from nearest sector to asphalt road → €
Up to 1 km: 50


1–3 km: 100


3–10 km: 200


More than 10 km: 300



4) Data Model (suggested keys)
crop → string (exact label from the lists above)


tariff = "T1" or "T2" (derived from crop)


area → string (exact label)


reservoirs → string (exact label)


outermostDistance → string (exact label)


plantAges → string (exact label)


varieties → string (exact label)


roadDistance → string (exact label)


Important: Use the exact option labels as keys into the price maps.

5) Pseudocode Logic
function resolveTariff(crop):
  if crop in T1_crops: return "T1"
  else if crop in T2_crops: return "T2"

function priceOf(tariff, tableName, label):
  table = FEES[tariff][tableName]
  return table[label] if exists else 0

function calculate(selection):
  tariff = resolveTariff(selection.crop)

  parts = {
    crop_base: FEES[tariff].crop_base,
    area: priceOf(tariff, "area_fee", selection.area),
    reservoirs: priceOf(tariff, "reservoirs_fee", selection.reservoirs),
    outermost_distance: priceOf(tariff, "outermost_distance_fee", selection.outermostDistance),
    plant_age_groups: priceOf(tariff, "plant_age_groups_fee", selection.plantAges),
    varieties: priceOf(tariff, "variety_count_fee", selection.varieties),
    road_distance: priceOf(tariff, "road_distance_fee", selection.roadDistance)
  }

  total = sum(parts.values)
  return { tariff, parts, total }

6) Example Calculations
Example A — 
T1 minimal
Crop: Blueberry → tariff T1 (crop_base 500)


Area: 0–5 ha → 200


Reservoirs: 0–1 → 500


Outermost distance: Less than 100 m. → 100


Plant ages: 1 → 200


Varieties: 1 → 200


Road distance: Up to 1 km → 50


Total = 500 + 200 + 500 + 100 + 200 + 200 + 50 = €1,750

Example B — 
T1 high
Crop: Apple (super-intensive, with support system) → T1 (500)


Area: Over 500 hectares → 2,800


Reservoirs: 6 or more → 5,000


Outermost distance: More than 3 km → 3,000


Plant ages: More than 10 → 2,000


Varieties: More than 10 → 2,000


Road distance: More than 10 km → 300


Total = 500 + 2,800 + 5,000 + 3,000 + 2,000 + 2,000 + 300 = €15,600

Example C — 
T2 minimal
Crop: Hazelnut → tariff T2 (500)


Area: 0–5 ha → 100


Reservoirs: 0–1 → 500


Outermost distance: Less than 100 m → 100


Plant ages: 1 → 100


Varieties: 1 → 100


Road distance: Up to 1 km → 50


Total = 500 + 100 + 500 + 100 + 100 + 100 + 50 = €1,450

Example D — 
T2 max (defined options)
Crop: Walnut → T2 (500)


Area: > 500 ha → 1,400


Reservoirs: 5 → 2,500


Outermost distance: More than 3 km → 3,000


Plant ages: More than 10 → 1,000


Varieties: More than 10 → 1,000


Road distance: More than 10 km → 300


Total = 500 + 1,400 + 2,500 + 3,000 + 1,000 + 1,000 + 300 = €8,700

7) Edge Cases & Rules
Unknown option in a selected tariff → price 0 (do not crash).
Different labels across tariffs (e.g., punctuation/spacing) are intentional; use them exactly.
Enable calculation only when all 7 fields are chosen.
Tariff switching: when crop changes, reload valid option lists for that tariff.
Line-item breakdown should always accompany the total.



2. Farm Details
All items must have titles. Each title is followed by the bold text.
Personal Information *
Under this section, the following fields need to be filled in and all of them are required
About Company
Company Name
Identification Code
Company Email
Company Director
First/Last Name
Mobile


Contact Person
First/Last Name
Mobile
Note: Each field in this section must allow text input, including both letters and numbers.
2. Farm Overview*
Location 
when clicking this input it should open a google map where the user will be able to search and it gives suggestions about places, use google maps place-autocomplete. 
After choosing location it should save location name itself, latitude and longitude
Google maps key is defined in application as env variable `VITE_APP_GOOGLE_MAPS_API_KEY`
Cadastral Codes
User should be able to enter multiple codes
Upload (KML/KMZ Files)
Crop *
- We keep it in the same format as it is now - the list of crops.
Total Planted Area *
- Ability to enter a number, with “ha” displayed next to it.
3. Historical soil Analyses *
Upload button that allows uploading of: PDF / Word (.doc, .docx) / Excel (.xls, .xlsx) / Image formats (.jpg, .jpeg, .png)
4. Last Yield*
 Ability to enter a number, with “Tone” displayed next to it.
5. Loan Details
Loan Amount
- Ability to enter a number with a currency selector button next to it and user should be able to choose between `USD, GEL` 
Loan Duration
- A calendar should appear, allowing selection of the start and end dates of the loan period.
Loan Issuance Date
A calendar should appear, allowing selection of the date when the loan was issued.
Add Another Loan

- There should be the ability to add one or multiple loans along with their details.


6. Bank’s Comment on Farmer
The bank viewer must have a comment box (Simple textarea)
7. Other (Upload files or add a comment)

- Include a comment box and file upload button.


Final Action Button: Register Farmer
After pressing the `Register Farmer` button system should save information in database and show success message for end-user with this message `Farmer registration completed successfully. We will review the submitted information and contact you shortly`

4. IMPACT ANALYSIS
Who will be affected?
The bank and Administrator (Telagri)  will be able to register farmers directly.
Administrator (Telagri) will have the ability to automatically receive information about farmers registered by the bank.
Will this break existing workflows? No. Existing farmer records remain unchanged. Only new registrations will use the updated form. 
Do users need training on the changes? Minimal
5. SUCCESS CRITERIA
How will we know the change is successful? 
Banks complete registration without confusion. 
Reduction in user support requests related to farmer registration. 

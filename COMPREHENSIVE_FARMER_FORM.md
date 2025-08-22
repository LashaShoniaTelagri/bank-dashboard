# Comprehensive Farmer Registration Form

## Overview
The TelAgri Bank Dashboard now includes a comprehensive farmer registration form that allows banks to collect detailed agricultural information from farmers. This form is designed to meet the specific requirements for agricultural loan applications and F-100 report generation.

## Features

### 🏗️ Form Structure
The form is organized into 4 main sections using tabs for better user experience:

1. **ძირითადი ინფო (Basic Information)**
   - Bank selection
   - Farmer type (Person/Company)
   - Personal/Company details
   - Contact information

2. **ფერმის მონაცემები (Farm Data)**
   - Farm location
   - Total area
   - Crop types and varieties
   - Harvest information
   - Equipment list

3. **ირიგაცია (Irrigation)**
   - Irrigation system type
   - Water source
   - Reservoir information
   - Irrigation sectors

4. **დოკუმენტები (Documents)**
   - Irrigation system schema upload
   - Laboratory analysis upload

### 📋 Required Fields

#### Basic Information
- **ბანკი (Bank)** - Required
- **ფერმერის ტიპი (Farmer Type)** - Person or Company
- **სახელი, გვარი (First Name, Last Name)** - For individuals
- **შპს დასახელება (Company Name)** - For companies
- **პირადი ნომერი (ID Number)** - Required
- **საკონტაქტო ტელეფონი (Contact Phone)**
- **ელ-ფოსტა (Email)**
- **მისამართი (Address)**

#### Farm Data
- **ფერმის მდებარეობა (Farm Location)**
- **ფართობი (Total Area)** - In hectares
- **კულტურა (Crop Type)** - Dropdown with common Georgian crops
- **ჯიშები და ფართობები (Crop Varieties)** - Dynamic list with:
  - Variety name
  - Planting year
  - Area in hectares
- **შარშანდელი მოსავლის რაოდენობა (Last Year Harvest)** - Quantity and unit
- **ტექნიკის ჩამონათვალი (Equipment List)** - Text area

#### Irrigation System
- **ირიგაციის ტიპი (Irrigation Type)** - Dropdown options:
  - წვეთოვანი (Drip)
  - სპრინკლერი (Sprinkler)
  - ზედაპირული (Surface)
  - ქვედაპირული (Subsurface)
  - სხვა (Other)
- **წყლის წყარო (Water Source)** - Dropdown options:
  - მდინარე (River)
  - წყალსაცავი (Reservoir)
  - ჭა (Well)
  - წყლის ქსელი (Water Network)
  - სხვა (Other)
- **საირიგაციო სექტორების რაოდენობა (Irrigation Sectors Count)**
- **რეზერვუარი აქვს (Has Reservoir)** - Checkbox
- **რეზერვუარების რაოდენობა (Reservoir Count)** - If reservoirs exist
- **რეზერვუარების მოცულობები (Reservoir Volumes)** - Dynamic list with volumes in m³

#### Documents
- **საირიგაციო სისტემის სქემა (Irrigation System Schema)** - File upload
- **ლაბორატორიული ანალიზები (Laboratory Analysis)** - File upload

### 🗄️ Database Schema

The farmer table has been extended with the following new columns:

```sql
-- New comprehensive fields
company_name text,
first_name text,
last_name text,
farm_location text,
total_area_hectares numeric(10,2),
crop_type text,
crop_varieties jsonb, -- Store varieties with years and areas
irrigation_type text,
has_reservoir boolean default false,
reservoir_count integer,
reservoir_volumes jsonb, -- Store individual reservoir volumes
water_source text,
last_year_harvest_quantity numeric(10,2),
last_year_harvest_unit text,
irrigation_sectors_count integer,
irrigation_system_schema_path text, -- File path for uploaded schema
equipment_list text,
lab_analysis_path text; -- File path for uploaded lab analysis
```

### 📁 File Storage

A new storage bucket `farmer-documents` has been created for storing:
- Irrigation system schemas
- Laboratory analysis documents

Files are organized by bank and type:
```
farmer-documents/
├── bank/{bank_id}/
│   ├── schema/
│   └── labAnalysis/
```

### 🔐 Security

- Row Level Security (RLS) policies ensure users can only access data for their bank
- File uploads are restricted to authenticated users with appropriate permissions
- All sensitive data is properly validated and sanitized

### 🎨 User Interface

#### Design Features
- **Tabbed Interface** - Organized sections for better navigation
- **Dynamic Forms** - Add/remove crop varieties and reservoir volumes
- **File Upload** - Drag-and-drop interface with progress indicators
- **Responsive Design** - Works on desktop and mobile devices
- **Georgian Language** - All labels and messages in Georgian
- **Validation** - Real-time form validation with helpful error messages

#### Color Scheme
- Primary: Emerald to Teal gradient
- Secondary: Slate grays
- Success: Green
- Error: Red
- Warning: Yellow

### 🚀 Usage

#### For Banks
1. Navigate to the Farmers section
2. Click "Add Farmer" button
3. Fill out the comprehensive form across all 4 tabs
4. Upload required documents
5. Submit the form

#### For Administrators
- Can access all farmers across all banks
- Can edit existing farmer information
- Can delete farmers (with confirmation)

#### For Bank Viewers
- Can only view farmers from their assigned bank
- Cannot edit or delete farmers

### 🔧 Technical Implementation

#### Components
- `ComprehensiveFarmerModal.tsx` - Main form component
- `FarmersTable.tsx` - Updated to use the new modal
- Database migration for schema changes

#### Dependencies
- React 18 with TypeScript
- TanStack Query for data management
- Supabase for backend services
- shadcn/ui for UI components
- Lucide React for icons

#### State Management
- Local form state with React hooks
- Optimistic updates for better UX
- Proper error handling and loading states

### 📊 Data Validation

#### Required Fields
- Bank selection
- Farmer type
- Name (company name for companies, first/last name for individuals)
- ID number

#### Optional Fields
- All other fields are optional but recommended for complete farmer profiles

#### File Upload Validation
- Supported formats: PDF, JPG, JPEG, PNG, DOC, DOCX
- File size limits enforced by Supabase storage
- Automatic file naming to prevent conflicts

### 🔄 Migration Instructions

To apply the database changes:

1. **Link to Supabase project:**
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

2. **Apply migration:**
   ```bash
   npx supabase db push
   ```

3. **Verify changes:**
   - Check that new columns exist in the farmers table
   - Verify storage bucket creation
   - Test file upload functionality

### 🧪 Testing

#### Manual Testing Checklist
- [ ] Form opens correctly
- [ ] All tabs are accessible
- [ ] Dynamic fields work (add/remove crop varieties, reservoir volumes)
- [ ] File uploads work
- [ ] Form validation works
- [ ] Data saves correctly
- [ ] Edit mode works
- [ ] Responsive design works on mobile

#### Automated Testing
- Unit tests for form validation
- Integration tests for database operations
- E2E tests for complete user workflows

### 🐛 Known Issues

None currently identified.

### 🔮 Future Enhancements

- **GPS Coordinates** - Add map integration for farm location
- **Photo Upload** - Add ability to upload farm photos
- **Bulk Import** - Excel/CSV import for multiple farmers
- **Advanced Search** - Search by crop type, area, etc.
- **Export Functionality** - Export farmer data to PDF/Excel
- **Mobile App** - Native mobile app for field data collection

---

**Note:** This comprehensive form is designed to meet the specific requirements of Georgian agricultural banking and can be extended as needed for additional use cases.
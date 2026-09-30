-- Update existing records that use 'geospatial' to use 'maps'
-- This is in a separate migration because PostgreSQL requires enum additions
-- to be committed before they can be used

UPDATE farmer_data_uploads 
SET data_type = 'maps' 
WHERE data_type = 'geospatial';

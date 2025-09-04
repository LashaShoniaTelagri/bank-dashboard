import { useQuery } from "@tanstack/react-query";

interface Crop {
  id: string;
  name: string;
  image_url: string;
  country_code: string;
}

interface CropsResponse {
  success: boolean;
  data: Crop[];
}

export const useCrops = () => {
  return useQuery({
    queryKey: ['crops'],
    queryFn: async (): Promise<Crop[]> => {
      try {
        const response = await fetch('https://api-gateway.telagri.com/crops/v1/list/');
        
        if (!response.ok) {
          console.error('Failed to fetch crops:', response.status, response.statusText);
          throw new Error(`Failed to fetch crops: ${response.status}`);
        }
        
        const result: CropsResponse = await response.json();
        
        if (!result.success || !result.data) {
          console.error('API returned unsuccessful response:', result);
          throw new Error('API returned unsuccessful response');
        }
        
        return result.data;
      } catch (error) {
        console.error('Error fetching crops:', error);
        // Return empty array as fallback
        return [];
      }
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour (renamed from cacheTime in newer versions)
    retry: 2, // Retry failed requests twice
    retryDelay: 1000, // Wait 1 second between retries
  });
};

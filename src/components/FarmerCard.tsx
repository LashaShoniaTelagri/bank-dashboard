import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin, 
  Wheat, 
  TrendingUp, 
  FileText,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Building2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FarmerCardProps {
  farmer: {
    farmer_id: string;
    farmer_name: string;
    farmer_location?: string;
    crop?: string;
    area?: number;
    loan_amount?: number;
    loan_status?: 'active' | 'pending' | 'defaulted';
    registration_date?: string;
    chart_count?: number;
    map_count?: number;
    bank_name?: string;
    bank_logo?: string;
  };
  isAdmin: boolean;
  onEdit?: (farmerId: string) => void;
  onDelete?: (farmerId: string) => void;
}

export const FarmerCard = ({ farmer, isAdmin, onEdit, onDelete }: FarmerCardProps) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Active</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pending</Badge>;
      case 'defaulted':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Defaulted</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const handleCardClick = () => {
    navigate(`/farmers/${farmer.farmer_id}`);
  };

  const handleQuickAction = (action: 'edit' | 'delete', e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card navigation
    if (action === 'edit' && onEdit) {
      onEdit(farmer.farmer_id);
    } else if (action === 'delete' && onDelete) {
      onDelete(farmer.farmer_id);
    }
  };

  return (
    <Card 
      className={`
        cursor-pointer transition-all duration-300 ease-in-out
        hover:shadow-xl hover:scale-[1.02]
        ${isHovered ? 'border-emerald-500 dark:border-emerald-400' : 'border-border'}
        bg-card/60 dark:bg-card/40 backdrop-blur-sm
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Wheat className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <h3 className="font-semibold text-lg text-foreground truncate">
                {farmer.farmer_name}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              ID: {farmer.farmer_id.slice(0, 8)}...
            </p>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {getStatusBadge(farmer.loan_status)}
            
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={(e) => handleQuickAction('edit', e as any)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Farmer
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCardClick}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => handleQuickAction('delete', e as any)}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Farmer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Bank Info with Logo (Admin only) */}
        {isAdmin && farmer.bank_name && (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border/50">
            {farmer.bank_logo ? (
              <img 
                src={farmer.bank_logo} 
                alt={farmer.bank_name}
                className="h-8 w-auto max-w-[80px] object-contain rounded"
                onError={(e) => {
                  // Fallback to icon if image fails to load
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <Building2 
              className={`h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400 ${farmer.bank_logo ? 'hidden' : ''}`} 
            />
            <span className="text-sm font-medium text-foreground truncate flex-1">
              {farmer.bank_name}
            </span>
          </div>
        )}

        {/* Location */}
        {farmer.farmer_location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{farmer.farmer_location}</span>
          </div>
        )}

        {/* Crop and Area */}
        {farmer.crop && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Crop:</span>
            <span className="font-medium text-foreground">
              {farmer.crop} {farmer.area ? `(${farmer.area} ha)` : ''}
            </span>
          </div>
        )}

        {/* Loan Amount */}
        {farmer.loan_amount && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Loan:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              €{farmer.loan_amount.toLocaleString()}
            </span>
          </div>
        )}

        {/* Analytics Preview */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              {farmer.chart_count !== undefined && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>{farmer.chart_count} Charts</span>
                </div>
              )}
              {farmer.map_count !== undefined && (
                <div className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  <span>{farmer.map_count} Maps</span>
                </div>
              )}
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
              onClick={handleCardClick}
            >
              View Details
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};


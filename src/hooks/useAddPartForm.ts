import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useReducer } from "react";

type InventoryItem = {
  id: string;
  name: string | null;
  part_number: string | null;
  quantity: number | null;
  unit_price: number | null;
  location: string | null;
  supplier: string | null;
  [key: string]: unknown;
};

export type SourceType = "inventory" | "external" | "service" | "tyre-inventory";

export interface PreviousPartUsage {
  date: string;
  jobCardNumber?: string;
  partName?: string;
  notes?: string;
}

export interface VehicleInfo {
  registrationNumber: string;
  fleetNumber?: string;
}

interface FormState {
  sourceType: SourceType;
  partName: string;
  partNumber: string;
  quantity: number;
  notes: string;
  serviceDescription: string;
  selectedInventoryId: string | null;
  selectedTyreId: string | null;
  unitPrice: number;
  availableQuantity: number;
  location: string;
  supplier: string;
  selectedVendorId: string;
  irNumber: string;
  documentFile: File | null;
  isSubmitting: boolean;
  isUploading: boolean;
  showInventorySearch: boolean;
  showRepeatedAlert: boolean;
  previousUsages: PreviousPartUsage[];
  vehicleInfo: VehicleInfo | null;
}

type FormAction =
  | { type: "SET_SOURCE_TYPE"; payload: SourceType }
  | { type: "SET_PART_NAME"; payload: string }
  | { type: "SET_PART_NUMBER"; payload: string }
  | { type: "SET_QUANTITY"; payload: number }
  | { type: "SET_NOTES"; payload: string }
  | { type: "SET_SERVICE_DESCRIPTION"; payload: string }
  | { type: "SET_SELECTED_INVENTORY_ID"; payload: string | null }
  | { type: "SET_UNIT_PRICE"; payload: number }
  | { type: "SET_AVAILABLE_QUANTITY"; payload: number }
  | { type: "SET_LOCATION"; payload: string }
  | { type: "SET_SUPPLIER"; payload: string }
  | { type: "SET_SELECTED_VENDOR_ID"; payload: string }
  | { type: "SET_IR_NUMBER"; payload: string }
  | { type: "SET_DOCUMENT_FILE"; payload: File | null }
  | { type: "SET_IS_SUBMITTING"; payload: boolean }
  | { type: "SET_IS_UPLOADING"; payload: boolean }
  | { type: "SET_SHOW_INVENTORY_SEARCH"; payload: boolean }
  | { type: "SET_SHOW_REPEATED_ALERT"; payload: boolean }
  | { type: "SET_PREVIOUS_USAGES"; payload: PreviousPartUsage[] }
  | { type: "SET_VEHICLE_INFO"; payload: VehicleInfo | null }
  | { type: "SELECT_INVENTORY_ITEM"; payload: InventoryItem }
  | { type: "SELECT_TYRE_ITEM"; payload: { id: string; partName: string; partNumber: string; unitPrice: number } }
  | { type: "RESET" };

const initialState: FormState = {
  sourceType: "inventory",
  partName: "",
  partNumber: "",
  quantity: 1,
  notes: "",
  serviceDescription: "",
  selectedInventoryId: null,
  selectedTyreId: null,
  unitPrice: 0,
  availableQuantity: 0,
  location: "",
  supplier: "",
  selectedVendorId: "",
  irNumber: "",
  documentFile: null,
  isSubmitting: false,
  isUploading: false,
  showInventorySearch: false,
  showRepeatedAlert: false,
  previousUsages: [],
  vehicleInfo: null,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_SOURCE_TYPE": {
      const base = {
        ...state,
        sourceType: action.payload,
      };
      if (action.payload === "inventory") {
        return { ...base, selectedVendorId: "", serviceDescription: "", selectedTyreId: null };
      }
      if (action.payload === "tyre-inventory") {
        return {
          ...base,
          selectedInventoryId: null,
          selectedVendorId: "",
          serviceDescription: "",
          availableQuantity: 0,
          partName: "",
          partNumber: "",
          unitPrice: 0,
          quantity: 1,
        };
      }
      if (action.payload === "external") {
        return {
          ...base,
          selectedInventoryId: null,
          selectedTyreId: null,
          availableQuantity: 0,
          serviceDescription: "",
        };
      }
      // service
      return {
        ...base,
        selectedInventoryId: null,
        selectedTyreId: null,
        availableQuantity: 0,
        partNumber: "",
      };
    }
    case "SET_PART_NAME":
      return { ...state, partName: action.payload };
    case "SET_PART_NUMBER":
      return { ...state, partNumber: action.payload };
    case "SET_QUANTITY":
      return { ...state, quantity: action.payload };
    case "SET_NOTES":
      return { ...state, notes: action.payload };
    case "SET_SERVICE_DESCRIPTION":
      return { ...state, serviceDescription: action.payload };
    case "SET_SELECTED_INVENTORY_ID":
      return { ...state, selectedInventoryId: action.payload };
    case "SET_UNIT_PRICE":
      return { ...state, unitPrice: action.payload };
    case "SET_AVAILABLE_QUANTITY":
      return { ...state, availableQuantity: action.payload };
    case "SET_LOCATION":
      return { ...state, location: action.payload };
    case "SET_SUPPLIER":
      return { ...state, supplier: action.payload };
    case "SET_SELECTED_VENDOR_ID":
      return { ...state, selectedVendorId: action.payload };
    case "SET_IR_NUMBER":
      return { ...state, irNumber: action.payload };
    case "SET_DOCUMENT_FILE":
      return { ...state, documentFile: action.payload };
    case "SET_IS_SUBMITTING":
      return { ...state, isSubmitting: action.payload };
    case "SET_IS_UPLOADING":
      return { ...state, isUploading: action.payload };
    case "SET_SHOW_INVENTORY_SEARCH":
      return { ...state, showInventorySearch: action.payload };
    case "SET_SHOW_REPEATED_ALERT":
      return { ...state, showRepeatedAlert: action.payload };
    case "SET_PREVIOUS_USAGES":
      return { ...state, previousUsages: action.payload };
    case "SET_VEHICLE_INFO":
      return { ...state, vehicleInfo: action.payload };
    case "SELECT_INVENTORY_ITEM":
      return {
        ...state,
        partName: action.payload.name || "",
        partNumber: action.payload.part_number || "",
        selectedInventoryId: action.payload.id,
        unitPrice: action.payload.unit_price || 0,
        availableQuantity: action.payload.quantity || 0,
        location: action.payload.location || "",
        supplier: action.payload.supplier || "",
      };
    case "SELECT_TYRE_ITEM":
      return {
        ...state,
        selectedTyreId: action.payload.id,
        partName: action.payload.partName,
        partNumber: action.payload.partNumber,
        unitPrice: action.payload.unitPrice,
        quantity: 1,
      };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

interface ValidationError {
  field: string;
  message: string;
}

export function validateForm(state: FormState): ValidationError | null {
  if (!state.partName.trim()) {
    return { field: "partName", message: "Part/service name is required" };
  }
  if (state.quantity <= 0) {
    return { field: "quantity", message: "Quantity must be greater than 0" };
  }
  if (state.sourceType === "service" && !state.serviceDescription.trim()) {
    return {
      field: "serviceDescription",
      message: "Service description is required for service items",
    };
  }
  if (state.sourceType === "inventory" && !state.selectedInventoryId) {
    return {
      field: "inventory",
      message: "Please select an inventory item",
    };
  }
  if (state.sourceType === "tyre-inventory" && !state.selectedTyreId) {
    return {
      field: "tyre-inventory",
      message: "Please select a tyre from the holding bay",
    };
  }
  return null;
}

// Define a type for the parts request insert data
type PartsRequestInsert = {
  job_card_id: string;
  part_name: string;
  part_number: string | null;
  quantity: number;
  notes: string | null;
  status: string;
  unit_price: number | null;
  total_price: number | null;
  vendor_id: string | null;
  ir_number: string | null;
  is_service: boolean;
  is_from_inventory: boolean;
  service_description: string | null;
  document_url: string | null;
  document_name: string | null;
  inventory_id: string | null;
  tyre_id: string | null;
  allocated_to_job_card?: boolean;
  allocated_at?: string;
};

export function useAddPartForm(
  jobCardId: string,
  open: boolean,
  onSuccess: () => void,
  onOpenChange: (open: boolean) => void,
  isTyreJobCard: boolean = false
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(formReducer, initialState);

  // Computed values
  const totalPrice = useMemo(
    () => state.quantity * state.unitPrice,
    [state.quantity, state.unitPrice]
  );

  const hasInsufficientStock = useMemo(
    () =>
      !!state.selectedInventoryId &&
      state.quantity > state.availableQuantity,
    [state.selectedInventoryId, state.quantity, state.availableQuantity]
  );

  const isLowStock = useMemo(
    () =>
      state.availableQuantity > 0 &&
      state.availableQuantity <= state.quantity * 2,
    [state.availableQuantity, state.quantity]
  );

  // Reset form when dialog closes; set default source type based on job card type
  useEffect(() => {
    if (!open) {
      dispatch({ type: "RESET" });
    } else if (isTyreJobCard) {
      dispatch({ type: "SET_SOURCE_TYPE", payload: "tyre-inventory" });
    }
  }, [open, isTyreJobCard]);

  const handleInventorySelect = useCallback((item: InventoryItem) => {
    dispatch({ type: "SELECT_INVENTORY_ITEM", payload: item });
  }, []);

  const handleTyreSelect = useCallback((tyre: { id: string; brand: string; model: string; size: string; serial_number: string | null; purchase_cost_zar: number | null; purchase_price: number | null }) => {
    dispatch({
      type: "SELECT_TYRE_ITEM",
      payload: {
        id: tyre.id,
        partName: `${tyre.brand} ${tyre.model} ${tyre.size}`,
        partNumber: tyre.serial_number || "",
        unitPrice: tyre.purchase_cost_zar ?? tyre.purchase_price ?? 0,
      },
    });
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          toast({
            variant: "destructive",
            title: "File Too Large",
            description: "Please upload a file smaller than 5MB",
          });
          return;
        }
        dispatch({ type: "SET_DOCUMENT_FILE", payload: file });
      }
    },
    [toast]
  );

  const uploadDocument = useCallback(async (): Promise<string | null> => {
    if (!state.documentFile) return null;

    dispatch({ type: "SET_IS_UPLOADING", payload: true });
    try {
      const fileExt = state.documentFile.name.split(".").pop();
      const fileName = `${jobCardId}-${Date.now()}.${fileExt}`;
      const filePath = `job-card-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, state.documentFile);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Document upload error:", error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Could not upload document. Please try again.",
      });
      return null;
    } finally {
      dispatch({ type: "SET_IS_UPLOADING", payload: false });
    }
  }, [state.documentFile, jobCardId, toast]);

  const checkForRepeatedUsage = useCallback(
    async (
      inventoryId: string | null,
      partNameToCheck: string
    ): Promise<PreviousPartUsage[]> => {
      try {
        const { data: currentJobCard, error: jobCardError } = await supabase
          .from("job_cards")
          .select("vehicle_id, vehicles(registration_number, fleet_number)")
          .eq("id", jobCardId)
          .single();

        if (jobCardError || !currentJobCard?.vehicle_id) {
          return [];
        }

        const vehicleData = currentJobCard.vehicles as { registration_number: string; fleet_number: string } | { registration_number: string; fleet_number: string }[] | null;
        if (vehicleData) {
          const vehicle = Array.isArray(vehicleData)
            ? vehicleData[0]
            : vehicleData;
          if (vehicle) {
            dispatch({
              type: "SET_VEHICLE_INFO",
              payload: {
                registrationNumber: vehicle.registration_number,
                fleetNumber: vehicle.fleet_number,
              },
            });
          }
        }

        const { data: vehicleJobCards, error: jobCardsError } = await supabase
          .from("job_cards")
          .select("id, job_number, created_at")
          .eq("vehicle_id", currentJobCard.vehicle_id)
          .neq("id", jobCardId);

        if (jobCardsError || !vehicleJobCards?.length) {
          return [];
        }

        const jobCardIds = vehicleJobCards.map((jc) => jc.id);

        let query = supabase
          .from("parts_requests")
          .select("id, part_name, notes, created_at, job_card_id")
          .in("job_card_id", jobCardIds);

        if (inventoryId) {
          query = query.eq("inventory_id", inventoryId);
        } else {
          query = query.ilike("part_name", partNameToCheck);
        }

        const { data: previousParts, error: partsError } = await query;

        if (partsError || !previousParts?.length) {
          return [];
        }

        return previousParts.map((part) => {
          const matchingJobCard = vehicleJobCards.find(
            (jc) => jc.id === part.job_card_id
          );
          return {
            date: part.created_at,
            jobCardNumber: matchingJobCard?.job_number || "Unknown",
            partName: part.part_name,
            notes: part.notes || undefined,
          };
        });
      } catch (error) {
        console.error("Error checking for repeated usage:", error);
        return [];
      }
    },
    [jobCardId]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent, repeatReason?: string) => {
      e.preventDefault();

      const validationError = validateForm(state);
      if (validationError) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: validationError.message,
        });
        return;
      }

      // ADDED: Validate vendor selection for external parts
      if (state.sourceType === "external" && !state.selectedVendorId) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please select a vendor for external parts",
        });
        return;
      }

      // Check for repeated usage on the same vehicle (only for parts, not services)
      if (state.sourceType !== "service" && !repeatReason) {
        const usages = await checkForRepeatedUsage(
          state.selectedInventoryId,
          state.partName
        );
        if (usages.length > 0) {
          dispatch({ type: "SET_PREVIOUS_USAGES", payload: usages });
          dispatch({ type: "SET_SHOW_REPEATED_ALERT", payload: true });
          return;
        }
      }

      dispatch({ type: "SET_IS_SUBMITTING", payload: true });

      try {
        let uploadedDocUrl: string | null = null;
        if (state.documentFile) {
          uploadedDocUrl = await uploadDocument();
          if (!uploadedDocUrl && state.documentFile) {
            throw new Error("Document upload failed");
          }
        }

        let finalNotes = state.notes || null;
        if (repeatReason) {
          const repeatNote = `[REPEATED USAGE - ${new Date().toLocaleString()}]\nReason: ${repeatReason}`;
          finalNotes = finalNotes
            ? `${finalNotes}\n\n${repeatNote}`
            : repeatNote;
        }

        // Prepare the insert data with proper typing - FIXED: vendor_id is now set for external parts
        const insertData: PartsRequestInsert = {
          job_card_id: jobCardId,
          part_name: state.partName,
          part_number: state.sourceType === "service" ? null : (state.partNumber || null),
          quantity: state.quantity,
          notes: finalNotes,
          status: "pending",
          unit_price: state.unitPrice || null,
          total_price: totalPrice || null,
          // FIXED: Set vendor_id for external parts, null for others
          vendor_id: state.sourceType === "external" ? state.selectedVendorId : null,
          ir_number: state.irNumber || null,
          is_service: state.sourceType === "service",
          is_from_inventory: state.sourceType === "inventory" || state.sourceType === "tyre-inventory",
          service_description: state.sourceType === "service" ? state.serviceDescription : null,
          document_url: uploadedDocUrl,
          document_name: state.documentFile?.name || null,
          inventory_id: state.sourceType === "inventory" ? (state.selectedInventoryId || null) : null,
          tyre_id: state.sourceType === "tyre-inventory" ? (state.selectedTyreId || null) : null,
        };

        // If it's an inventory item, re-read current stock from DB to avoid stale cache issues
        if (state.sourceType === "inventory" && state.selectedInventoryId) {
          const { data: currentItem, error: stockCheckError } = await supabase
            .from("inventory")
            .select("quantity")
            .eq("id", state.selectedInventoryId)
            .single();

          if (stockCheckError) {
            console.error("Error checking current stock:", stockCheckError);
            throw stockCheckError;
          }

          const currentStock = currentItem?.quantity ?? 0;

          if (currentStock >= state.quantity) {
            // Sufficient stock — fulfill directly from inventory
            const newQuantity = currentStock - state.quantity;
            const { error: inventoryError } = await supabase
              .from("inventory")
              .update({ quantity: newQuantity })
              .eq("id", state.selectedInventoryId);

            if (inventoryError) {
              console.error("Error updating inventory:", inventoryError);
              throw inventoryError;
            }

            // Mark as fulfilled — this removes it from the procurement list
            insertData.status = "fulfilled";
            insertData.allocated_to_job_card = true;
            insertData.allocated_at = new Date().toISOString();
          } else {
            // Insufficient stock — send to procurement
            insertData.notes = insertData.notes
              ? `${insertData.notes}\n\n[OUT OF STOCK - needs procurement] Available: ${currentStock}, Requested: ${state.quantity}`
              : `[OUT OF STOCK - needs procurement] Available: ${currentStock}, Requested: ${state.quantity}`;
          }
        }

        // If it's a tyre from holding bay, mark as allocated
        if (state.sourceType === "tyre-inventory" && state.selectedTyreId) {
          // Update tyre position to 'allocated' so it's no longer in holding bay
          const { error: tyreError } = await supabase
            .from("tyres")
            .update({ position: "allocated" })
            .eq("id", state.selectedTyreId);

          if (tyreError) {
            console.error("Error updating tyre position:", tyreError);
            throw tyreError;
          }

          insertData.status = "fulfilled";
          insertData.allocated_to_job_card = true;
          insertData.allocated_at = new Date().toISOString();
        }

        // Create the parts request
        const { error: insertError } = await supabase
          .from("parts_requests")
          .insert([insertData]);

        if (insertError) {
          console.error("Error inserting parts request:", insertError);
          throw insertError;
        }

        // Success message based on type
        if (state.sourceType === "tyre-inventory") {
          toast({
            title: "Success",
            description: "Tyre allocated from holding bay to job card",
          });
        } else if (state.sourceType === "inventory" && insertData.status === "fulfilled") {
          toast({
            title: "Success",
            description: `Part allocated from inventory (${state.quantity} units)`,
          });
        } else if (state.sourceType === "inventory" && insertData.status === "pending") {
          toast({
            title: "Request Created",
            description: "Part is out of stock - request sent to procurement",
          });
        } else {
          toast({
            title: "Success",
            description: `${state.sourceType === "service" ? "Service" : "Part"} request submitted successfully`,
          });
        }

        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["job_card_parts", jobCardId] });
        queryClient.invalidateQueries({ queryKey: ["procurement-requests"] });
        if (state.sourceType === "tyre-inventory") {
          queryClient.invalidateQueries({ queryKey: ["holding_bay_tyres_for_job_card"] });
          queryClient.invalidateQueries({ queryKey: ["tyre_bays"] });
          queryClient.invalidateQueries({ queryKey: ["installed_tyres"] });
        }

        requestGoogleSheetsSync('workshop');
        onSuccess();
        onOpenChange(false);

      } catch (error) {
        console.error("Error in handleSubmit:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to add part/service",
        });
      } finally {
        dispatch({ type: "SET_IS_SUBMITTING", payload: false });
      }
    },
    [
      state,
      jobCardId,
      toast,
      queryClient,
      onSuccess,
      onOpenChange,
      checkForRepeatedUsage,
      uploadDocument,
      totalPrice,
    ]
  );

  const handleRepeatedActionConfirm = useCallback(
    (reason: string) => {
      dispatch({ type: "SET_SHOW_REPEATED_ALERT", payload: false });
      const syntheticEvent = {
        preventDefault: () => { },
      } as React.FormEvent;
      handleSubmit(syntheticEvent, reason);
    },
    [handleSubmit]
  );

  return {
    state,
    dispatch,
    totalPrice,
    hasInsufficientStock,
    isLowStock,
    handleInventorySelect,
    handleTyreSelect,
    handleFileChange,
    handleSubmit,
    handleRepeatedActionConfirm,
  };
}
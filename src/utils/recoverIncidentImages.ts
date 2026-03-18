import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface IncidentImage {
  url: string;
  name: string;
  uploaded_at: string;
}

/**
 * Recovers orphaned images from storage for a specific incident.
 * This utility scans the storage bucket for files that belong to an incident
 * but are not recorded in the database.
 */
export async function recoverIncidentImages(incidentId: string): Promise<{
  found: IncidentImage[];
  existing: IncidentImage[];
  recovered: boolean;
  error?: string;
}> {
  console.log("Recovery - Starting image recovery for incident:", incidentId);

  try {
    // Step 1: Get current incident data
    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id, incident_number, images")
      .eq("id", incidentId)
      .single();

    if (incidentError || !incident) {
      return {
        found: [],
        existing: [],
        recovered: false,
        error: `Incident not found: ${incidentError?.message || "Unknown error"}`,
      };
    }

    console.log("Recovery - Current incident images:", incident.images);

    // Parse existing images
    const existingImages: IncidentImage[] = Array.isArray(incident.images)
      ? (incident.images as unknown as IncidentImage[])
      : [];

    // Step 2: List files in storage for this incident
    const { data: files, error: listError } = await supabase.storage
      .from("incident-images")
      .list(incidentId, {
        limit: 100,
        offset: 0,
      });

    if (listError) {
      console.error("Recovery - Failed to list storage files:", listError);
      return {
        found: [],
        existing: existingImages,
        recovered: false,
        error: `Failed to list storage files: ${listError.message}`,
      };
    }

    console.log("Recovery - Found files in storage:", files);

    if (!files || files.length === 0) {
      console.log("Recovery - No files found in storage for this incident");
      return {
        found: [],
        existing: existingImages,
        recovered: false,
        error: "No files found in storage",
      };
    }

    // Step 3: Build list of images from storage
    const storageImages: IncidentImage[] = [];
    for (const file of files) {
      // Skip folders
      if (!file.name || file.name.startsWith(".")) continue;

      const filePath = `${incidentId}/${file.name}`;
      const { data: urlData } = supabase.storage
        .from("incident-images")
        .getPublicUrl(filePath);

      storageImages.push({
        url: urlData.publicUrl,
        name: file.name,
        uploaded_at: file.created_at || new Date().toISOString(),
      });
    }

    console.log("Recovery - Storage images:", storageImages);

    // Step 4: Find images in storage that are not in database
    const existingUrls = new Set(existingImages.map((img) => img.url));
    const newImages = storageImages.filter((img) => !existingUrls.has(img.url));

    if (newImages.length === 0) {
      console.log("Recovery - No orphaned images found");
      return {
        found: storageImages,
        existing: existingImages,
        recovered: false,
        error: "No orphaned images to recover",
      };
    }

    console.log("Recovery - Orphaned images to recover:", newImages);

    // Step 5: Update incident with recovered images
    const allImages = [...existingImages, ...newImages];

    const { error: updateError } = await supabase
      .from("incidents")
      .update({ images: allImages as unknown as Json })
      .eq("id", incidentId);

    if (updateError) {
      console.error("Recovery - Failed to update incident:", updateError);
      return {
        found: storageImages,
        existing: existingImages,
        recovered: false,
        error: `Failed to update incident: ${updateError.message}`,
      };
    }

    // Step 6: Add timeline entry
    await supabase.from("incident_timeline").insert({
      incident_id: incidentId,
      event_type: "photo_added",
      event_title: "Photos Recovered",
      event_description: `${newImages.length} orphaned photo(s) were recovered from storage`,
      performed_by: "System Recovery",
    });

    console.log("Recovery - Successfully recovered", newImages.length, "images");

    return {
      found: storageImages,
      existing: existingImages,
      recovered: true,
    };
  } catch (err) {
    console.error("Recovery - Unexpected error:", err);
    return {
      found: [],
      existing: [],
      recovered: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Lists all files in storage for a specific incident without modifying anything.
 * Useful for debugging.
 */
export async function listIncidentStorageFiles(incidentId: string): Promise<{
  files: Array<{ name: string; url: string; created_at: string }>;
  error?: string;
}> {
  try {
    const { data: files, error } = await supabase.storage
      .from("incident-images")
      .list(incidentId, {
        limit: 100,
        offset: 0,
      });

    if (error) {
      return { files: [], error: error.message };
    }

    const result = (files || [])
      .filter((f) => f.name && !f.name.startsWith("."))
      .map((file) => {
        const filePath = `${incidentId}/${file.name}`;
        const { data: urlData } = supabase.storage
          .from("incident-images")
          .getPublicUrl(filePath);

        return {
          name: file.name,
          url: urlData.publicUrl,
          created_at: file.created_at || "",
        };
      });

    return { files: result };
  } catch (err) {
    return {
      files: [],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
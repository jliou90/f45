export type ConflictResolution = "reload" | "overwrite" | "cancel";

export type ConflictModalPayload = {
  entityType: string;
  entityId: string;
  attemptedIfMatch?: string;
};

export type ConflictModalResult = {
  resolution: ConflictResolution;
};

export interface HealthResponse {
  status: string;
  app_name: string;
  environment: string;
  version: string;
}

export interface RootResponse {
  status: string;
  message: string;
}

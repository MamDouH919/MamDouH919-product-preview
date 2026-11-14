import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { GatewayId } from '../providers/payment-provider';

export class UpdateGatewaySettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(GatewayId))
  provider?: GatewayId;

  /**
   * Credentials for `provider` (or the saved one). A secret left out or blank
   * keeps the saved value; a plain field sent blank is cleared.
   */
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
}

export class TestGatewayDto {
  @IsOptional()
  @IsString()
  @IsIn(Object.values(GatewayId))
  provider?: GatewayId;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
}

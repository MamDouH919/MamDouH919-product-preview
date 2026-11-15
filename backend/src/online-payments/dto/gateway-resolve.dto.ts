import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** What staff found at the gateway for a refund stuck "in progress". */
export const RESOLVE_OUTCOMES = ['sent', 'not_sent'] as const;
export type ResolveOutcome = (typeof RESOLVE_OUTCOMES)[number];

export class ResolveGatewayRefundDto {
  /** `sent`: the gateway shows the money went back. `not_sent`: it does not, so it may be tried again. */
  @IsIn(RESOLVE_OUTCOMES)
  outcome!: ResolveOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength, IsEmail } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ required: true })
  @IsString()
  token!: string;
}

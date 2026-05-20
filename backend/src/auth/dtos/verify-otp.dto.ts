import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ required: true })
  @IsEmail()
  email!: string;

  @ApiProperty({ required: true })
  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp!: string;
}

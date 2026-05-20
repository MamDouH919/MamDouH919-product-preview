import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength, IsEmail } from 'class-validator';

export class LoginDto {
  @ApiProperty({ required: true })
  @IsEmail()
  email!: string;

  @ApiProperty({ required: true })
  @IsString()
  password!: string;
}

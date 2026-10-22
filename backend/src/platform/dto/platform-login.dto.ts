import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class PlatformLoginDto {
  @ApiProperty({ required: true })
  @IsEmail()
  email!: string;

  @ApiProperty({ required: true })
  @IsString()
  password!: string;
}

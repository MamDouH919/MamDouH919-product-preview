import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength, IsEmail } from 'class-validator';

export class SignupDto {
  @ApiProperty({ required: true })
  @IsString()
  name!: string;

  @ApiProperty({ required: true })
  @IsEmail()
  email!: string;

  @ApiProperty({ required: true })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[0-9])/, {
    message: 'Password must contain at least one number',
  })
  password!: string;
}

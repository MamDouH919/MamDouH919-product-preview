import { IsString, Matches, MinLength, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class ChangePasswordDto {
  @ApiProperty({ required: true })
  @IsString()
  oldPassword!: string;

  @ApiProperty({ required: true })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[0-9])/, {
    message: 'Password must contain at least one number',
  })
  newPassword!: string;
}

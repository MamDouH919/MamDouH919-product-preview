import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('mail.user'),
        pass: this.configService.get<string>('mail.pass'),
      },
    });
  }

  async sendOtp(to: string, otp: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>('mail.user'),
      to,
      subject: 'Your OTP Code',
      html: `
        <h2>Email Verification</h2>
        <p>Your OTP code is: <strong>${otp}</strong></p>
        <p>This code will expire in 5 minutes.</p>
      `,
    });
  }

  async sendResetPasswordLink(to: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;
    await this.transporter.sendMail({
      from: this.configService.get<string>('mail.user'),
      to,
      subject: 'Reset Your Password',
      html: `
        <h2>Password Reset</h2>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });
  }
}
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { escapeHtml } from '../common/helpers/escape-html';

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

  /** Sends an already-rendered message from the store's mailbox. */
  async send(message: {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
  }): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>('mail.user'),
      ...message,
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

  async sendContactNotification(data: {
    name: string;
    email: string;
    phone?: string;
    subject?: string;
    message: string;
  }): Promise<void> {
    const to = this.configService.get<string>('mail.user');
    await this.transporter.sendMail({
      from: this.configService.get<string>('mail.user'),
      to,
      replyTo: data.email,
      // Subject is plain text, but strip line breaks so it can't add headers.
      subject: `New Contact Message${data.subject ? `: ${data.subject.replace(/[\r\n]+/g, ' ')}` : ''}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
        ${data.phone ? `<p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>` : ''}
        ${data.subject ? `<p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>` : ''}
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(data.message).replace(/\n/g, '<br/>')}</p>
      `,
    });
  }

  async sendResetPasswordLink(
    to: string,
    token: string,
    frontendUrl?: string,
    // Admins and storefront customers reset their passwords on different pages.
    path = 'reset-password',
  ): Promise<void> {
    // Prefer the tenant's frontend origin; fall back to the global env value.
    const baseUrl = frontendUrl ?? this.configService.get<string>('frontendUrl');
    const resetLink = `${baseUrl}/${path}?token=${token}`;
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
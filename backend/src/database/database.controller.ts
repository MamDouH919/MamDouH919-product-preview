import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response, Request } from 'express';
import { DatabaseService } from './database.service';
import { AuthenticationGuard } from '../guards/authentication.guard';

@Controller('database')
@UseGuards(AuthenticationGuard)
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('export')
  async export(@Req() req: Request & { userId: string }, @Res() res: Response) {
    const data = await this.databaseService.exportAll(req.userId, req.hostname);
    const filename = `store-export-${req.hostname}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  }

  /** Multipart: `file`, plus `password`, `confirm` (the store's host) and `dryRun` ("false" to write). */
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @Req() req: Request & { userId: string },
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { password?: string; confirm?: string; dryRun?: string },
  ) {
    return this.databaseService.importAll(req.userId, req.hostname, file?.buffer, {
      password: body?.password,
      confirm: body?.confirm,
      dryRun: body?.dryRun !== 'false',
    });
  }
}

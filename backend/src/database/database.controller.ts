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
    const data = await this.databaseService.exportAll(req.userId);
    const filename = `db-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @Req() req: Request & { userId: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = JSON.parse(file.buffer.toString('utf-8'));
    await this.databaseService.importAll(req.userId, data);
    return { message: 'Import successful' };
  }
}

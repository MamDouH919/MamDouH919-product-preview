import { Controller, Get } from '@nestjs/common';
import { SitemapService } from './sitemap.service';

/** Public. Read by the storefront's `sitemap.xml` route on the server. */
@Controller('sitemap')
export class SitemapController {
  constructor(private readonly sitemapService: SitemapService) {}

  @Get()
  entries() {
    return this.sitemapService.entries();
  }
}

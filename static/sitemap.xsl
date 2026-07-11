<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:si="http://www.sitemaps.org/schemas/sitemap/0.9"
  exclude-result-prefixes="sm si">

  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <!-- ── Shared styles ──────────────────────────────────────────────────── -->
  <xsl:template name="head">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Sitemap — KisanDeals</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F8F9FA;color:#212529;padding:1.5rem}
        .wrap{max-width:960px;margin:0 auto}
        .hd{display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem}
        .hd-icon{width:40px;height:40px;background:#2E7D32;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.2rem;flex-shrink:0}
        h1{font-size:1.15rem;font-weight:700;color:#1B5E20}
        .sub{font-size:.8rem;color:#6C757D;margin-top:.15rem}
        .card{background:#fff;border:1px solid #E9ECEF;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)}
        table{width:100%;border-collapse:collapse;font-size:.82rem}
        thead tr{background:#2E7D32;color:#fff}
        th{padding:.6rem 1rem;text-align:left;font-weight:600;font-size:.78rem;letter-spacing:.03em}
        td{padding:.5rem 1rem;border-bottom:1px solid #F0F0F0;vertical-align:middle}
        tr:last-child td{border-bottom:none}
        tr:hover td{background:#F8FFF8}
        a{color:#2E7D32;text-decoration:none;word-break:break-all}
        a:hover{text-decoration:underline}
        .badge{display:inline-block;padding:.15rem .45rem;border-radius:20px;font-size:.72rem;font-weight:600}
        .badge-daily{background:#E8F5E9;color:#2E7D32}
        .badge-hourly{background:#E3F2FD;color:#1565C0}
        .badge-weekly{background:#FFF3E0;color:#E65100}
        .badge-monthly{background:#F3E5F5;color:#6A1B9A}
        .pri-hi{color:#2E7D32;font-weight:600}
        .pri-md{color:#6C757D}
        .pri-lo{color:#ADB5BD}
        .count{font-size:.78rem;color:#6C757D;padding:.5rem 1rem;border-top:1px solid #E9ECEF;background:#FAFAFA}
        .sitemap-link{display:flex;align-items:center;gap:.5rem}
        .sitemap-link .icon{font-size:.9rem}
      </style>
    </head>
  </xsl:template>

  <!-- ── Sitemap index ──────────────────────────────────────────────────── -->
  <xsl:template match="/sm:sitemapindex">
    <html>
      <xsl:call-template name="head"/>
      <body>
        <div class="wrap">
          <div class="hd">
            <div class="hd-icon">🌿</div>
            <div>
              <h1>KisanDeals Sitemap Index</h1>
              <div class="sub"><xsl:value-of select="count(sm:sitemap)"/> sitemap files</div>
            </div>
          </div>
          <div class="card">
            <table>
              <thead>
                <tr>
                  <th>Sitemap File</th>
                  <th style="width:140px">Last Modified</th>
                </tr>
              </thead>
              <tbody>
                <xsl:for-each select="sm:sitemap">
                  <tr>
                    <td>
                      <div class="sitemap-link">
                        <span class="icon">📄</span>
                        <a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a>
                      </div>
                    </td>
                    <td style="color:#6C757D"><xsl:value-of select="sm:lastmod"/></td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
            <div class="count"><xsl:value-of select="count(sm:sitemap)"/> sitemap file(s)</div>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>

  <!-- ── URL set (individual sitemaps) ─────────────────────────────────── -->
  <xsl:template match="/sm:urlset">
    <html>
      <xsl:call-template name="head"/>
      <body>
        <div class="wrap">
          <div class="hd">
            <div class="hd-icon">🌿</div>
            <div>
              <h1>KisanDeals Sitemap</h1>
              <div class="sub"><xsl:value-of select="count(sm:url)"/> URLs in this file</div>
            </div>
          </div>
          <div class="card">
            <table>
              <thead>
                <tr>
                  <th>URL</th>
                  <th style="width:120px">Change Freq</th>
                  <th style="width:80px">Priority</th>
                </tr>
              </thead>
              <tbody>
                <xsl:for-each select="sm:url">
                  <tr>
                    <td><a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a></td>
                    <td>
                      <xsl:variable name="cf" select="sm:changefreq"/>
                      <span>
                        <xsl:attribute name="class">
                          badge
                          <xsl:choose>
                            <xsl:when test="$cf='hourly'"> badge-hourly</xsl:when>
                            <xsl:when test="$cf='daily'"> badge-daily</xsl:when>
                            <xsl:when test="$cf='weekly'"> badge-weekly</xsl:when>
                            <xsl:otherwise> badge-monthly</xsl:otherwise>
                          </xsl:choose>
                        </xsl:attribute>
                        <xsl:value-of select="$cf"/>
                      </span>
                    </td>
                    <td>
                      <xsl:variable name="pr" select="number(sm:priority)"/>
                      <span>
                        <xsl:attribute name="class">
                          <xsl:choose>
                            <xsl:when test="$pr &gt;= 0.8">pri-hi</xsl:when>
                            <xsl:when test="$pr &gt;= 0.5">pri-md</xsl:when>
                            <xsl:otherwise>pri-lo</xsl:otherwise>
                          </xsl:choose>
                        </xsl:attribute>
                        <xsl:value-of select="sm:priority"/>
                      </span>
                    </td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
            <div class="count"><xsl:value-of select="count(sm:url)"/> URL(s)</div>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>

</xsl:stylesheet>

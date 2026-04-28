import * as XLSX from 'xlsx';

export interface PortfolioRow {
  ticker: string;
  shares: number;
  averagePrice: number;
  isin?: string;
}

// Parses standard Excel tables with columns: Ticker/Тикер, Shares/Количество, Price/Цена
export function parseExcelPortfolio(file: File): Promise<PortfolioRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const json = XLSX.utils.sheet_to_json<any>(worksheet);
        
        const rows: PortfolioRow[] = json.map((row) => {
          const ticker = row['Тикер'] || row['Ticker'] || row['Символ'] || row['Инструмент'];
          const shares = row['Количество'] || row['Shares'] || row['Шт'] || row['Кол-во'];
          const averagePrice = row['Средняя цена'] || row['Average Price'] || row['Цена покупки'] || row['Цена'];
          
          if (!ticker || shares === undefined || averagePrice === undefined) {
             return null;
          }

          return {
            ticker: String(ticker).trim(),
            shares: Number(shares),
            averagePrice: Number(averagePrice)
          };
        }).filter(Boolean) as PortfolioRow[];

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
}

// Parses FINAM brocker XML reports
export async function parseXMLPortfolio(file: File): Promise<PortfolioRow[]> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let text = "";

    // Check for UTF-16LE BOM or null bytes pattern
    if ((bytes[0] === 0xFF && bytes[1] === 0xFE) || (bytes[1] === 0x00 && bytes[3] === 0x00)) {
      text = new TextDecoder("utf-16le").decode(buffer);
    } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
      text = new TextDecoder("utf-16be").decode(buffer);
    } else {
      text = new TextDecoder("utf-8").decode(buffer);
      if (text.includes("\uFFFD")) {
         text = new TextDecoder("windows-1251").decode(buffer);
      }
    }

    text = text.replace(/\0/g, '').trim();

    if (!text.includes("<REPORT_DOC>")) {
       throw new Error("Неверный формат XML. Ожидается отчет брокера (например, Финам).");
    }

    // A helper to parse attributes from a tag string
    const parseAttrs = (tagStr: string) => {
       const attrs: Record<string, string> = {};
       const regex = /([a-zA-Z0-9_\-]+)="([^"]*)"/g;
       let match;
       while ((match = regex.exec(tagStr)) !== null) {
          attrs[match[1]] = match[2].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
       }
       return attrs;
    };

    const evaluationMap: Record<string, number> = {};
    const db6Match = text.match(/<DB6\b[^>]*>([\s\S]*?)<\/DB6>/i);
    if (db6Match) {
        const rRegex = /<R\s+([^>]+?)\/?>/gi;
        let rMatch;
        while ((rMatch = rRegex.exec(db6Match[1])) !== null) {
            const attrs = parseAttrs(rMatch[1]);
            let rawTicker = attrs['IS'] || attrs['ISIN'] || attrs['I'] || 'Unknown';
            let ticker = rawTicker.split(' ')[0].replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '');
            const outShares = Number(attrs['Out'] || 0);
            const evalPrice = Number(attrs['PlE'] || attrs['PlB'] || attrs['EvalE'] || attrs['EvalB'] || 0);
            if (outShares > 0 && Math.abs(evalPrice) > 0) {
               evaluationMap[ticker] = Math.abs(evalPrice) / outShares;
            }
        }
    }

    const db5Match = text.match(/<DB5\b[^>]*>([\s\S]*?)<\/DB5>/i);
    if (!db5Match) {
        return [];
    }

    const rows: PortfolioRow[] = [];
    const rRegex = /<R\s+([^>]+?)\/?>/gi;
    let rMatch;
    while ((rMatch = rRegex.exec(db5Match[1])) !== null) {
        const attrs = parseAttrs(rMatch[1]);
        
        let rawTicker = attrs['IS'] || attrs['ISIN'] || attrs['I'] || 'Unknown';
        let ticker = rawTicker.split(' ')[0].replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '');
        let isin = attrs['ISIN'];

        const shares = Number(attrs['T1'] || attrs['T2'] || attrs['T3'] || attrs['TN'] || 0);

        let averagePrice = evaluationMap[ticker] || 0;
        
        if (averagePrice === 0) {
            let cost = Number(attrs['CostB'] || attrs['CostE'] || 0);
            averagePrice = shares > 0 ? (cost / shares) : 0;
        }

        if (averagePrice === 0) {
            averagePrice = 1;
        }

        if (shares > 0) {
            rows.push({
                ticker,
                isin,
                shares,
                averagePrice
            });
        }
    }

    return rows;
  } catch (err) {
     throw err;
  }
}

// Unified parser
export async function parsePortfolioFile(file: File): Promise<PortfolioRow[]> {
  if (file.name.toLowerCase().endsWith('.xml')) {
    return parseXMLPortfolio(file);
  } else {
    return parseExcelPortfolio(file);
  }
}

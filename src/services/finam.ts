export interface FinamPortfolio {
  account_id: string;
  type: string;
  status: string;
  equity: number;
  unrealized_profit: number;
  positions: FinamPosition[];
}

export interface FinamPosition {
  symbol: string;
  quantity: number;
  average_price: number;
  current_price: number;
  daily_pnl: number;
  unrealized_pnl: number;
}

export async function fetchFinamPortfolio(apiKey: string): Promise<FinamPortfolio | null> {
  try {
    // 1. Get Access Token
    const sessionRes = await fetch('https://api.finam.ru/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ secret: apiKey })
    });
    
    if (!sessionRes.ok) throw new Error('Failed to create Finam session (check API key)');
    const sessionData = await sessionRes.json();
    const token = sessionData.token;
    
    // 2. Get Account ID Details
    const detailsRes = await fetch('https://api.finam.ru/v1/sessions/details', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    if (!detailsRes.ok) throw new Error('Failed to get Finam session details');
    const detailsData = await detailsRes.json();
    const accountIds = detailsData.account_ids || [];
    if (accountIds.length === 0) throw new Error('No accounts found for this Finam API key');
    
    const accountId = accountIds[0];
    
    // 3. Get Account / Portfolio
    const portfolioRes = await fetch(`https://api.finam.ru/v1/accounts/${accountId}`, {
      method: 'GET',
      headers: {
        'Authorization': token
      }
    });

    if (!portfolioRes.ok) throw new Error('Failed to get Finam portfolio');
    const portfolioData = await portfolioRes.json();

    return {
      account_id: portfolioData.account_id,
      type: portfolioData.type,
      status: portfolioData.status,
      equity: parseFloat(portfolioData.equity?.value || "0"),
      unrealized_profit: parseFloat(portfolioData.unrealized_profit?.value || "0"),
      positions: (portfolioData.positions || []).map((pos: any) => ({
        symbol: pos.symbol,
        quantity: parseFloat(pos.quantity?.value || "0"),
        average_price: parseFloat(pos.average_price?.value || "0"),
        current_price: parseFloat(pos.current_price?.value || "0"),
        daily_pnl: parseFloat(pos.daily_pnl?.value || "0"),
        unrealized_pnl: parseFloat(pos.unrealized_pnl?.value || "0")
      }))
    };
  } catch (e) {
    console.error("Finam API Error:", e);
    throw e;
  }
}

import 'dotenv/config'
import puppeteer from 'puppeteer'

const fetchDetails = async (processNumber) => {
    const browser = await puppeteer.launch({
        // headless: false,
        // devtools: true,
    })

    const page = await browser.newPage()
    await page.goto(process.env.CPOPG_URL)
    await page.setViewport({width: 1000, height: 1000})
    
    await page.type('#numeroDigitoAnoUnificado', processNumber.slice(0,15))
    await page.type('#foroNumeroUnificado', processNumber.slice(21, 25))

    await page.locator('#botaoConsultarProcessos').click()

    let lawyer = await page.waitForSelector('.fundoClaro .nomeParteEAdvogado')

    lawyer = await lawyer.evaluate(node => {
        let text = node.innerText
        const position = text.search('Advogado:')
        return position > 0 ? text.slice(position + 10, text.length) : false
    })
    
    const processAmount = await page.waitForSelector('#valorAcaoProcesso')
    const parsedAmount = await processAmount.evaluate(node => node.innerText.replaceAll('R$', '').trim())
    
    await browser.close()

    return{ lawyer, parsedAmount }
}

/* fetchProcess('1000235-71.2024.8.26.0498').then((res) => {
    console.log(res)
}) */
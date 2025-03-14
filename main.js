import 'dotenv/config'
import puppeteer from 'puppeteer'
import { writeFileSync } from 'fs'

let list = []

const fetchProcesses = async () => {
    const browser = await puppeteer.launch({
        headless: false,
        // devtools: true
    })

    const context = await browser.createBrowserContext()

    const page = await context.newPage()
    await page.goto(process.env.CJPG_URL)
    await page.setViewport({width: 1000, height: 1000})

    let currentPage = 1
    let totalPages = process.env.TOTAL_PAGES || 1

    while (currentPage <= totalPages) {
        const processes = await page.evaluate(() => {
            function sanitizeNode(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    // Remove leading/trailing whitespaces, tabs, and newlines
                    node.textContent = node.textContent.replace(/[\n\t\r]+/g, ' ').trim();
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // Recursively sanitize child nodes for elements
                    Array.from(node.childNodes).forEach(sanitizeNode);
                }
            }
    
            const processes = document.querySelectorAll('.fundocinza1')
    
            return Array.from(processes).map(p => {
                const processo =            p.querySelector('td:nth-child(2) tr:nth-child(1) span')?.innerText?.trim()
                const comarca =             p.querySelector('td:nth-child(2) tr:nth-child(5)')?.innerText?.trim().replace('Comarca: ', '')
                const foro =                p.querySelector('td:nth-child(2) tr:nth-child(6)')?.innerText?.trim().replace('Foro: ', '')
                const disponibilizacao =    p.querySelector('td:nth-child(2) tr:nth-child(8)')?.innerText?.trim().replace('Data de Disponibilização: ', '')
                let texto =                 p.querySelector('td:nth-child(2) tr:nth-child(9) div:nth-child(2) span')
                sanitizeNode(texto)
                texto = texto.innerText
    
                return { processo, comarca, foro, disponibilizacao, texto }
            })
        })
    
        list.push(processes)
        
        await page.click('.trocaDePagina a:last-of-type')
        currentPage++
    }

    await context.close()

    storeProcesses()
}

const fetchProcessDetails = async (processNumber) => {
    const newPage = await context.newPage()
    await newPage.goto(process.env.CJPG_URL)

    await newPage.type('.form-control-nuProcesso', processNumber)
    await newPage.click('#botaoConsultarProcessos')
}

const storeProcesses = async () => {
    list = list.flat()
    writeFileSync('processos.json', JSON.stringify(list, null, 2), 'utf-8')
    console.log('Mal feito, feito!')
}

fetchProcesses()
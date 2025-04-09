export const useGetTodayDate = () => {
  const date = new Date()
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}

export const useGetUpdatedUrl = () => {
  let url = new URL(process.env.CJPG_URL)
  let params = new URLSearchParams(url.search)

  params.set('dadosConsulta.dtFim', useGetTodayDate())

  url.search = params.toString()
  return url.href
}
import CorporateContractSignClient from './CorporateContractSignClient'

export default function CorporateContractSignPage({
  searchParams
}: {
  searchParams: { token?: string }
}) {
  return <CorporateContractSignClient token={searchParams.token ?? ''} />
}

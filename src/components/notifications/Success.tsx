import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

export const showSuccess = (signature: string) => {
    const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=${import.meta.env.VITE_CLUSTER}`;
    withReactContent(Swal).fire({
      icon: 'success',
      title: 'Transaction successful',
      html: `Transaction sent!<br><a href="${explorerUrl}" target="_blank" style="color: #3085d6;">View on Solana Explorer</a>`,
    });
  };
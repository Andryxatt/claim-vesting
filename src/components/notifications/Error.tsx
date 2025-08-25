import Swal from "sweetalert2"
import withReactContent from "sweetalert2-react-content"

export const showError = (text: string) => {
    withReactContent(Swal).fire({
      icon: 'error',
      title: 'Not found',
      text: text,
    })
  }
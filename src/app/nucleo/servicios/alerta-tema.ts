import Swal from 'sweetalert2';

const AlertaTema = Swal.mixin({
  buttonsStyling: false,
  scrollbarPadding: false,
  customClass: {
    popup: 'app-swal-popup',
    title: 'app-swal-title',
    htmlContainer: 'app-swal-html',
    actions: 'app-swal-actions',
    confirmButton: 'app-swal-btn app-swal-btn--confirm',
    cancelButton: 'app-swal-btn app-swal-btn--cancel',
    denyButton: 'app-swal-btn app-swal-btn--deny',
    closeButton: 'app-swal-close',
    icon: 'app-swal-icon',
  },
});

export default AlertaTema;

import { ref } from 'vue';

export default function () {
  const time = ref(Date.now());

  const getNow: any = () => {
    time.value = Date.now();
  };

  return [time, getNow];
}

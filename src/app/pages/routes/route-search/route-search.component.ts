import { Component, ElementRef, Injector, OnDestroy, OnInit, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { RouteService } from '../../../services/route.service';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ConnectivityService } from '../../../core/connectivity.service';
import { RouteSearchParams, RouteSearchResult } from '../../../models/route.model';
import { ProblemDetail } from '../../../models/auth.model';
import { FavoriteDestination } from '../../../models/favorite.model';
import { RouteStepsComponent } from '../../../components/route-steps/route-steps.component';
import { distinctNeighborhoods } from '../../../lib/neighborhoods';
import { linestringEnds } from '../../../lib/linestring-ends';
import { FareTableComponent } from '../../../components/fare-table/fare-table.component';
import { LetreroComponent } from '../../../components/letrero/letrero.component';
import { MapViewComponent, LatLngPoint } from '../../../components/map-view/map-view.component';
import { MapPointPickerComponent, PickedPoints } from '../../../components/map-point-picker/map-point-picker.component';
import { TrafficBadgeComponent } from '../../../components/traffic-badge/traffic-badge.component';

/**
 * Pantalla de resultado de búsqueda (SCRUM-54, SCRUM-130): origen/destino, ruta
 * sugerida, última milla y mensaje de "no hay ruta" cuando aplique.
 *
 * Origen y destino se eligen de la lista de barrios del catálogo — el usuario nunca
 * escribe una coordenada (RNF-04: el flujo completo cabe en 4 acciones). En línea, la
 * geolocalización del navegador afina el origen por detrás; sin ella, o sin
 * conexión, el backend deriva un punto aproximado del nombre del barrio.
 */
@Component({
  selector: 'app-route-search',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RouteStepsComponent, FareTableComponent,
            LetreroComponent, MapViewComponent, MapPointPickerComponent, TrafficBadgeComponent],
  templateUrl: './route-search.component.html',
  styles: [`
    /* El select ocupa el ancho y la estrella se acomoda al lado, sin encogerlo. */
    .fr-campo-con-accion {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .fr-campo-con-accion > select { flex: 1 1 auto; min-width: 0; }

    .fr-boton-favorito {
      flex: 0 0 auto;
      background: transparent;
      border: var(--trazo-2) solid var(--borde);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      /* 44px es el mínimo táctil cómodo: la app se usa de pie en la calle. */
      min-width: 44px;
      min-height: 44px;
      color: var(--texto);
    }
    .fr-boton-favorito--activo { color: var(--amarillo-congestion, #d99a00); }
    .fr-boton-favorito:disabled { opacity: .45; cursor: not-allowed; }

    /*
     * Respuesta al toque. La estrella rebota y de debajo sale una onda que se
     * apaga: sin eso, pasar de ☆ a ★ es un cambio de un glifo por otro que en
     * un celular a pleno sol no se registra.
     *
     * Los keyframes (fr-pop, fr-anillo) están en el archivo global, no acá: con
     * la encapsulación de Angular un keyframe declarado en un componente recibe
     * un nombre reescrito y referenciarlo por el original falla callado.
     *
     * OJO: nada de acentos graves en estos comentarios. Están dentro de la
     * plantilla literal de styles y cualquiera de ellos la cierra antes de
     * tiempo. El error que sale es "Failed to resolve styles at position 1" y
     * no menciona el acento grave en ningún momento.
     */
    .fr-boton-favorito { position: relative; }
    .fr-boton-favorito > span { display: block; }
    .fr-boton-favorito--pulsado > span {
      animation: fr-pop var(--vel-media) var(--curva-resorte) both;
    }
    .fr-boton-favorito--pulsado::before {
      content: "";
      position: absolute;
      inset: -2px;
      border: var(--trazo-2) solid currentColor;
      border-radius: var(--radius-md);
      animation: fr-anillo var(--vel-lenta) var(--curva-salida) both;
      pointer-events: none;
    }

    /*
     * El número grande del tiempo estimado. La cifra tabular es obligatoria
     * porque el valor se cuenta hacia arriba: con cifras de ancho variable el
     * número se sacude de lado mientras sube, y el tirón se nota más que la
     * animación.
     */
    .fr-eta-numero {
      font: 700 32px/36px var(--font-display);
      color: var(--indigo-accion);
      font-variant-numeric: tabular-nums;
    }
    /* Foco visible: el formulario tiene que poder recorrerse con teclado. */
    .fr-boton-favorito:focus-visible { outline: var(--trazo-2) solid var(--texto); outline-offset: 2px; }

    .fr-nota-favorito { margin: var(--space-2) 0 0; }
  `],
})
export class RouteSearchComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly routeService = inject(RouteService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly userService = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly activatedRoute = inject(ActivatedRoute);
  /** Para `afterNextRender` fuera del constructor (desplazamiento al buscar). */
  private readonly injector = inject(Injector);

  readonly loading = signal(false);
  readonly result = signal<RouteSearchResult | null>(null);
  readonly notFoundMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly neighborhoods = signal<string[]>([]);
  readonly neighborhoodsError = signal(false);
  /**
   * Si el resultado en pantalla salió del endpoint offline. Antes se derivaba de
   * `estimatedMinutes === null`, pero el online ahora también puede responder sin tiempo
   * (SCRUM-130, Fase 1: cuando Google falla para todas las candidatas se degrada en vez
   * de dar 503). Un signal propio evita confundir ambas situaciones en el mensaje al
   * usuario — "sin conexión" vs. "no pudimos calcular el tiempo ahora".
   */
  readonly servedOffline = signal(false);
  /** Puntos fijados en el mapa, si los hay. Pisan a la geolocalización del origen. */
  readonly picked = signal<PickedPoints>({ origin: null, destination: null });

  /**
   * Valor que se pinta en el número grande de "se demora". Sube desde 0 hasta el
   * minuto real en ~650 ms en vez de aparecer de golpe.
   *
   * No es decoración: el tiempo estimado es el dato por el que la persona abrió
   * la app, y contarlo hacia arriba lo señala como lo importante de la pantalla
   * sin tener que agrandarlo ni pintarlo de otro color. Se mantiene aparte del
   * resultado — `result()` siempre tiene el valor verdadero, y lo que se anima
   * es solo la presentación.
   */
  readonly etaMostrado = signal(0);

  /** Dura lo que el rebote de la estrella; de ahí vuelve a false. */
  readonly favoritoPulsado = signal(false);

  /** Ancla de la zona de resultado, destino del desplazamiento al buscar. */
  private readonly zonaResultado = viewChild.required<ElementRef<HTMLElement>>('zonaResultado');

  /** `requestAnimationFrame` en vuelo del conteo, para poder cancelarlo. */
  private cuadroEta = 0;
  /** Temporizador del rebote de la estrella, para poder cancelarlo. */
  private relojPulso: ReturnType<typeof setTimeout> | null = null;

  readonly isOnline = this.connectivity.isOnline;
  readonly isUrban = computed(() => this.result()?.route.type === 'URBANA');

  /** En km cuando pasa del kilómetro, que es como se lee de un vistazo. */
  readonly travelDistanceLabel = computed(() => {
    const meters = this.result()?.travelDistanceInMeters;
    if (meters == null) return null;
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
  });

  /**
   * Datos del mapa en el resultado. `null` si la ruta sugerida no tiene trazado o si el
   * backend no mandó la clave (p. ej. versión anterior). Prefiere `boarding`/`dropOff`
   * como marcadores: son dónde el usuario toma y deja la buseta. Si no vienen, cae a
   * los extremos del trazado — la ruta se pinta igual, sin última milla.
   */
  readonly resultMap = computed(() => {
    const r = this.result();
    if (!r?.path) return null;
    const ends = linestringEnds(r.path);
    if (!ends) return null;
    const start: LatLngPoint = r.boarding
      ? { lat: r.boarding.latitude, lng: r.boarding.longitude }
      : ends.start;
    const end: LatLngPoint = r.dropOff
      ? { lat: r.dropOff.latitude, lng: r.dropOff.longitude }
      : ends.end;
    return { path: r.path, start, end };
  });

  searchForm = this.fb.group({
    originNeighborhood: ['', Validators.required],
    destinationNeighborhood: ['', Validators.required],
  });

  /** El destino marcado como favorito, si el usuario tiene sesión y tiene uno (RF-10). */
  readonly favorite = signal<FavoriteDestination | null>(null);
  /** Evita que un doble clic en la estrella mande dos peticiones. */
  readonly savingFavorite = signal(false);

  /**
   * La estrella se pinta llena cuando el destino elegido ES el favorito. Se compara
   * contra el valor del formulario y no contra una bandera propia para que, al
   * sobrescribir el destino precargado, la estrella se vacíe sola — el criterio de
   * aceptación dice que escribir otro destino no modifica el favorito guardado.
   */
  readonly chosenIsFavorite = computed(() =>
    !!this.favorite() && this.favorite()!.destination === this.destinationValue());

  /** Valor actual del campo destino, como signal para que `computed` lo observe. */
  private readonly destinationValue = signal('');

  /**
   * La estrella solo se ofrece con sesión: el favorito vive en la cuenta (RF-10), así
   * que a un anónimo le prometería algo que no se le puede guardar.
   */
  readonly canUseFavorite = computed(() => this.auth.isLoggedIn());

  /**
   * Sectores del aviso que se pinta al abrir la pantalla, antes de buscar. Desaparece
   * en cuanto hay un resultado: ese trae su propio aviso, calculado sobre el recorrido
   * real, y mostrar los dos a la vez diría dos cosas distintas sobre lo mismo.
   */
  readonly favoriteCongestion = computed(() => {
    if (this.result()) return null;
    const sectores = this.favorite()?.congestionSectors ?? [];
    return sectores.length > 0 ? sectores : null;
  });

  ngOnInit(): void {
    // Se repone el par ANTES de pedir el catálogo, y de forma sincrónica: así cualquier
    // precarga posterior que llegue por HTTP (el destino favorito de RF-10) encuentra el
    // campo con valor y no pisa lo que el usuario acaba de pulsar en su historial.
    this.restoreRepeatedSearch();

    this.routeService.getAllPublicRoutes().subscribe({
      next: (routes) => {
        const barrios = distinctNeighborhoods(routes);
        this.neighborhoods.set(barrios);
        this.dropRepeatedValuesMissingFrom(barrios);
      },
      error: () => this.neighborhoodsError.set(true),
    });

    this.searchForm.controls.destinationNeighborhood.valueChanges.subscribe(
      (value) => this.destinationValue.set(value ?? ''));

    this.loadFavorite();
  }

  ngOnDestroy(): void {
    // Un rAF o un setTimeout que sobrevive al componente escribe en signals de
    // una vista ya destruida. No revienta, pero es una fuga: con navegaciones
    // repetidas quedan cuadros encolados que no pintan nada.
    cancelAnimationFrame(this.cuadroEta);
    if (this.relojPulso !== null) clearTimeout(this.relojPulso);
  }

  /**
   * Si el sistema pide menos movimiento. Se consulta en cada animación y no se
   * guarda al construir el componente: la preferencia se puede cambiar con la
   * pestaña abierta.
   */
  private get movimientoReducido(): boolean {
    return typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Cuenta el tiempo estimado desde 0 hasta su valor real.
   *
   * La curva es `easeOutExpo`: arranca rápido y frena al final, igual que
   * `--curva-salida` del CSS. Un conteo lineal se siente mecánico y uno con
   * rebote pasaría por encima del valor real, que en un dato numérico sería
   * mostrar por un instante un número que es mentira.
   */
  private animarEta(objetivo: number): void {
    cancelAnimationFrame(this.cuadroEta);

    if (this.movimientoReducido) {
      this.etaMostrado.set(objetivo);
      return;
    }

    const duracion = 650;
    let inicio: number | null = null;

    const paso = (ahora: number) => {
      /*
       * El instante de arranque sale del PRIMER cuadro, no de
       * `performance.now()`. Mezclar los dos relojes da por hecho que
       * comparten origen de tiempo; donde no lo comparten, `ahora - inicio`
       * sale negativo, `Math.pow(2, -10 * avance)` se desborda y el numero
       * en pantalla salta a algo como -4e+94. Lo destaparon las pruebas.
       *
       * El recorte a [0, 1] es el cinturon por encima del tirante: con el
       * arranque tomado del propio cuadro no deberia hacer falta, pero un
       * valor fuera de rango aqui se ve como un numero absurdo, no como una
       * animacion fea.
       */
      inicio ??= ahora;
      const avance = Math.min(1, Math.max(0, (ahora - inicio) / duracion));
      const suavizado = avance === 1 ? 1 : 1 - Math.pow(2, -10 * avance);
      this.etaMostrado.set(Math.round(objetivo * suavizado));
      if (avance < 1) this.cuadroEta = requestAnimationFrame(paso);
    };

    this.cuadroEta = requestAnimationFrame(paso);
  }

  /**
   * Lleva la pantalla a la zona de resultado al empezar a buscar.
   *
   * No es un adorno. El botón vive pegado al borde inferior (zona del pulgar) y
   * el resultado se dibuja debajo del formulario, o sea fuera de pantalla: sin
   * esto, la persona toca "¡Hágale!" y lo único que cambia a la vista es una
   * barra de 4 px arriba. Lleva al esqueleto, no al resultado, porque el
   * esqueleto ya ocupa el sitio exacto que ocupará el resultado.
   *
   * Con movimiento reducido salta sin desplazamiento suave, que es
   * precisamente el movimiento de pantalla completa que molesta.
   */
  private irAlResultado(): void {
    const destino = this.zonaResultado().nativeElement;
    // jsdom no implementa scrollIntoView, y tampoco lo tiene todo navegador
    // incrustado. Sin esta guarda la busqueda lanzaba un TypeError: el
    // desplazamiento es un lujo, poder buscar no.
    if (typeof destino.scrollIntoView !== 'function') return;
    destino.scrollIntoView({
      behavior: this.movimientoReducido ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  /** Enciende el rebote de la estrella y lo apaga cuando la animación termina. */
  private pulsarFavorito(): void {
    if (this.movimientoReducido) return;
    if (this.relojPulso !== null) clearTimeout(this.relojPulso);
    this.favoritoPulsado.set(true);
    // 500 ms = --vel-lenta, que es lo que dura la onda (la más larga de las dos).
    this.relojPulso = setTimeout(() => this.favoritoPulsado.set(false), 500);
  }

  /**
   * Precarga el campo destino con el favorito al abrir la pantalla (RF-10).
   *
   * Solo con sesión: el favorito vive en la cuenta, así que pedirlo sin token sería un
   * 401 garantizado. Un fallo aquí se traga a propósito — no poder precargar no puede
   * impedir buscar, que es a lo que el usuario vino.
   */
  private loadFavorite(): void {
    if (!this.auth.isLoggedIn()) return;

    this.userService.getFavoriteDestination().subscribe({
      next: (favorite) => {
        if (!favorite) return;
        this.favorite.set(favorite);
        // Solo precarga si el usuario no escribió nada todavía: si ya eligió un
        // destino, pisárselo con el favorito sería quitarle lo que acaba de hacer.
        if (!this.searchForm.controls.destinationNeighborhood.value) {
          this.searchForm.controls.destinationNeighborhood.setValue(favorite.destination);
        }
      },
      error: () => this.favorite.set(null),
    });
  }

  /**
   * Marca o desmarca como favorito el destino elegido (RF-10). Es el mismo botón:
   * con un solo favorito por cuenta, marcar y cambiar son la misma acción para el
   * usuario.
   */
  toggleFavorite(): void {
    const destination = this.searchForm.controls.destinationNeighborhood.value;
    if (!destination || this.savingFavorite()) return;

    // El rebote va antes de la petición, no en la respuesta: el toque tiene que
    // sentirse acusado de inmediato. Si el guardado falla, el estado de la
    // estrella vuelve solo (sale de `favorite()`), y haber rebotado no afirma
    // que se guardó — eso lo dice la estrella llena, no la animación.
    this.pulsarFavorito();
    this.savingFavorite.set(true);
    const done = { complete: () => this.savingFavorite.set(false) };

    if (this.chosenIsFavorite()) {
      this.userService.clearFavoriteDestination().subscribe({
        next: () => this.favorite.set(null),
        error: () => this.savingFavorite.set(false),
        ...done,
      });
    } else {
      this.userService.setFavoriteDestination(destination).subscribe({
        next: (favorite) => this.favorite.set(favorite),
        error: () => this.savingFavorite.set(false),
        ...done,
      });
    }
  }

  /**
   * Repetir una búsqueda del historial (RF-07, SCRUM-82): la pantalla de historial
   * navega aquí con `?origen=&destino=` y el formulario llega relleno.
   *
   * El par viaja por la URL y no por un servicio de estado compartido, así la búsqueda
   * repetida se puede recargar, compartir y volver atrás.
   *
   * No se dispara la búsqueda sola, a propósito: el usuario viene de pulsar la entrada,
   * así que buscar es un toque más y el flujo sigue cabiendo en las 4 acciones de
   * RNF-04. Buscar automáticamente, en cambio, gastaría una llamada a Google en un
   * trayecto que quizá solo quería ajustar antes de consultarlo.
   */
  private restoreRepeatedSearch(): void {
    const params = this.activatedRoute.snapshot.queryParamMap;
    const origin = params.get('origen');
    const destination = params.get('destino');

    if (origin) {
      this.searchForm.controls.originNeighborhood.setValue(origin);
    }
    if (destination) {
      this.searchForm.controls.destinationNeighborhood.setValue(destination);
    }
  }

  /**
   * Un barrio repuesto que ya no está en el catálogo se limpia del formulario.
   *
   * Pasa si el barrio se renombró en la base desde el día de aquella búsqueda. Los
   * campos son `<select>`: un valor sin `<option>` que lo respalde deja el control
   * relleno pero en blanco en pantalla, y el usuario pulsaría "buscar" sobre un campo
   * que a él se le ve vacío. Mejor dejarlo elegir de nuevo.
   */
  private dropRepeatedValuesMissingFrom(barrios: string[]): void {
    for (const control of [
      this.searchForm.controls.originNeighborhood,
      this.searchForm.controls.destinationNeighborhood,
    ]) {
      const value = control.value;
      if (value && !barrios.includes(value)) {
        control.setValue('');
      }
    }
  }

  onSubmit(): void {
    if (this.searchForm.invalid) return;

    this.loading.set(true);
    this.result.set(null);
    this.notFoundMessage.set(null);
    this.errorMessage.set(null);
    this.etaMostrado.set(0);

    // Después del siguiente pintado, no ahora: el esqueleto todavía no está en
    // el DOM, y sin él la página no es lo bastante alta como para que el
    // desplazamiento llegue al ancla — el navegador lo recortaría.
    afterNextRender(() => this.irAlResultado(), { injector: this.injector });

    const { originNeighborhood, destinationNeighborhood } = this.searchForm.getRawValue();
    const picked = this.picked();
    const base: RouteSearchParams = {
      originNeighborhood: originNeighborhood!,
      destinationNeighborhood: destinationNeighborhood!,
      // Un destino elegido en el mapa es intención explícita del usuario y nunca lo
      // deriva el navegador: viaja tal cual.
      ...(picked.destination ? {
        destinationLat: picked.destination.lat,
        destinationLng: picked.destination.lng,
      } : {}),
    };

    if (picked.origin) {
      // El punto fijado pisa al GPS: si el usuario tocó el mapa, es porque quiere ESE
      // origen y no el que el navegador adivine.
      this.search({ ...base, originLat: picked.origin.lat, originLng: picked.origin.lng });
    } else if (this.isOnline()) {
      // Solo el origen: no existe geolocalización del destino de otra persona. Si el
      // navegador no la soporta, el usuario la niega o se agota el tiempo, se busca
      // igual sin coordenadas — nunca bloquea la búsqueda por esto.
      this.locateOrigin((origin) => this.search({ ...base, ...origin }));
    } else {
      this.search(base);
    }
  }

  onPickedPointsChange(points: PickedPoints): void {
    this.picked.set(points);
  }

  private locateOrigin(onSettled: (origin: Partial<RouteSearchParams>) => void): void {
    if (!('geolocation' in navigator)) {
      onSettled({});
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        onSettled({ originLat: position.coords.latitude, originLng: position.coords.longitude }),
      () => onSettled({}),
      { timeout: 5_000 },
    );
  }

  private search(params: RouteSearchParams): void {
    const offline = !this.connectivity.isOnline();
    this.run(offline ? this.routeService.searchRouteOffline(params) : this.routeService.searchRoute(params), offline, params);
  }

  private run(request: Observable<RouteSearchResult>, offline: boolean, params: RouteSearchParams): void {
    request.subscribe({
      next: (data) => {
        this.result.set(data);
        this.servedOffline.set(offline);
        this.loading.set(false);
        // El conteo arranca junto con la entrada de los bloques: el número sube
        // mientras la tarjeta se está asentando, no después.
        if (data.estimatedMinutes != null) this.animarEta(data.estimatedMinutes);
      },
      error: (err: HttpErrorResponse) => {
        // status 0 = "no salió de la máquina" (navigator.onLine miente a veces).
        // status 503 = Google rechazó/falló para todas las candidatas (Fase 1 ya lo
        // evita en el backend nuevo, pero este reintento cubre un backend viejo todavía
        // desplegado). En ambos casos el offline no necesita a Google y responde.
        if (!offline && (err.status === 0 || err.status === 503)) {
          this.run(this.routeService.searchRouteOffline(params), true, params);
          return;
        }
        this.loading.set(false);
        this.handleError(err);
      },
    });
  }

  private handleError(err: HttpErrorResponse): void {
    const body = err.error as ProblemDetail | undefined;
    // El backend responde 404 con ProblemDetail cuando ninguna ruta conecta los dos
    // barrios. Se distingue por el status y no por el texto: el mensaje puede cambiar.
    if (err.status === 404) {
      this.notFoundMessage.set(body?.detail ?? 'No hay rutas disponibles que conecten ese origen con ese destino.');
      return;
    }
    // Caso de PROD 2026-10-29: el backend viejo propagaba el 503 con el texto crudo
    // "Distance Matrix respondio status=REQUEST_DENIED", que al usuario no le dice
    // nada. El 503 ahora dispara un reintento offline (ver `run`); si ESE también
    // falla, mejor un mensaje genérico que el texto técnico de Google.
    if (err.status === 503) {
      this.errorMessage.set('No pudimos buscar la ruta en este momento. Intenta de nuevo en un momento.');
      return;
    }
    this.errorMessage.set(body?.detail ?? 'No se pudo completar la búsqueda. Intenta de nuevo.');
  }
}

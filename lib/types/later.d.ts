declare module '@breejs/later' {
  interface ScheduleData {
    /**
     * A list of recurrence information as a composite schedule.
     */
    schedules: Recurrence[];

    /**
     * A list of exceptions to the composite recurrence information.
     */
    exceptions: Recurrence[];

    /**
     * A code to identify any errors in the composite schedule and exceptions.
     * The number tells you the position of the error within the schedule.
     */
    error: number;
  }

  interface Recurrence {
    /** Time in seconds from midnight. */
    t?: number[];
    /** Seconds in minute. */
    s?: number[];
    /** Minutes in hour. */
    m?: number[];
    /** Hour in day. */
    h?: number[];
    /** Day of the month. */
    D?: number[];
    /** Day in week. */
    dw?: number[];
    /** Nth day of the week in month. */
    dc?: number[];
    /** Day in year. */
    dy?: number[];
    /** Week in month. */
    wm?: number[];
    /** ISO week in year. */
    wy?: number[];
    /** Month in year. */
    M?: number[];
    /** Year. */
    Y?: number[];

    /** After modifiers. */
    t_a?: number[];
    /** After modifiers. */
    s_a?: number[];
    /** After modifiers. */
    m_a?: number[];
    /** After modifiers. */
    h_a?: number[];
    /** After modifiers. */
    D_a?: number[];
    /** After modifiers. */
    dw_a?: number[];
    /** After modifiers. */
    dc_a?: number[];
    /** After modifiers. */
    dy_a?: number[];
    /** After modifiers. */
    wm_a?: number[];
    /** After modifiers. */
    wy_a?: number[];
    /** After modifiers. */
    M_a?: number[];
    /** After modifiers. */
    Y_a?: number[];

    /** Before modifiers. */
    t_b?: number[];
    /** Before modifiers. */
    s_b?: number[];
    /** Before modifiers. */
    m_b?: number[];
    /** Before modifiers. */
    h_b?: number[];
    /** Before modifiers. */
    D_b?: number[];
    /** Before modifiers. */
    dw_b?: number[];
    /** Before modifiers. */
    dc_b?: number[];
    /** Before modifiers. */
    dy_b?: number[];
    /** Before modifiers. */
    wm_b?: number[];
    /** Before modifiers. */
    wy_b?: number[];
    /** Before modifiers. */
    M_b?: number[];
    /** Before modifiers. */
    Y_b?: number[];

    /*
     * Custom Time Periods and Modifiers
     * For acces to custom time periods created as extension to the later static type
     * and modifiers created on the later modifier static type.
     */
    [timeperiodAndModifierName: string]: number[] | undefined;
  }

  const later: { parse: { text: (s: string) => ScheduleData } };

  export = later;
}

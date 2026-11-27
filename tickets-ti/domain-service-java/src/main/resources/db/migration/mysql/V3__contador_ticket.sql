-- M-06: un contador por año para el consecutivo de TKT-AAAA-NNNN. La creación de un ticket bloquea la fila de su año
-- (SELECT ... FOR UPDATE), así dos creaciones simultáneas no reciben el mismo número.
create table contador_ticket (
    anio integer not null,
    ultimo bigint not null,
    primary key (anio)
) engine=InnoDB;

-- Fila fija «año 0»: no es un año real, es el candado con el que se ordena la creación del contador de un año nuevo
-- (ver TicketRepositoryAdapter.siguienteConsecutivo).
insert into contador_ticket (anio, ultimo) values (0, 0);

-- Los años que ya tienen tickets siguen su numeración.
insert into contador_ticket (anio, ultimo)
select anio, max(consecutivo) from ticket group by anio;

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ERDTruck(Base):
    __tablename__ = "erd_trucks"

    plate_number: Mapped[str] = mapped_column(String(50), primary_key=True)
    truck_type: Mapped[str] = mapped_column(String(100), nullable=False)
    capacity: Mapped[float] = mapped_column(Float, nullable=False)

    trips: Mapped[list["ERDTrip"]] = relationship(back_populates="truck")
    schedules: Mapped[list["ERDTruckSchedule"]] = relationship(back_populates="truck")
    maintenance_reports: Mapped[list["ERDMaintenanceReport"]] = relationship(back_populates="truck")


class ERDRoute(Base):
    __tablename__ = "erd_routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    origin: Mapped[str] = mapped_column(String(255), nullable=False)
    destination: Mapped[str] = mapped_column(String(255), nullable=False)
    estimated_distance: Mapped[float] = mapped_column(Float, default=0)
    eta: Mapped[str] = mapped_column(String(100), default="")

    trips: Mapped[list["ERDTrip"]] = relationship(back_populates="route")


class ERDCustomer(Base):
    __tablename__ = "erd_customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(String(255), default="")
    contact: Mapped[str] = mapped_column(String(100), default="")
    balance: Mapped[float] = mapped_column(Float, default=0)
    type: Mapped[str] = mapped_column(String(50), default="regular")

    transactions: Mapped[list["ERDTransaction"]] = relationship(back_populates="customer")


class ERDBroker(Base):
    __tablename__ = "erd_brokers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    salary: Mapped[float] = mapped_column(Float, default=0)
    date_employed: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    transactions: Mapped[list["ERDTransaction"]] = relationship(back_populates="broker")


class ERDTransaction(Base):
    __tablename__ = "erd_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("erd_customers.id"), nullable=False)
    broker_id: Mapped[int | None] = mapped_column(ForeignKey("erd_brokers.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(50), default="booking")
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    creation_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    cancellation_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    customer: Mapped["ERDCustomer"] = relationship(back_populates="transactions")
    broker: Mapped["ERDBroker | None"] = relationship(back_populates="transactions")
    trip: Mapped["ERDTrip | None"] = relationship(back_populates="transaction", uselist=False)
    payment: Mapped["ERDPayment | None"] = relationship(back_populates="transaction", uselist=False)
    stocks: Mapped[list["ERDStock"]] = relationship(back_populates="transaction")


class ERDTrip(Base):
    __tablename__ = "erd_trips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("erd_transactions.id"), nullable=False, unique=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("erd_routes.id"), nullable=False)
    truck_id: Mapped[str] = mapped_column(ForeignKey("erd_trucks.plate_number"), nullable=False)
    driver_name: Mapped[str] = mapped_column(String(255), default="")
    helper_name: Mapped[str] = mapped_column(String(255), default="")
    trip_status: Mapped[str] = mapped_column(String(50), default="scheduled")
    departure_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    arrival_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    transaction: Mapped["ERDTransaction"] = relationship(back_populates="trip")
    route: Mapped["ERDRoute"] = relationship(back_populates="trips")
    truck: Mapped["ERDTruck"] = relationship(back_populates="trips")
    schedules: Mapped[list["ERDTruckSchedule"]] = relationship(back_populates="trip")
    fuel_records: Mapped[list["ERDFuelRecord"]] = relationship(back_populates="trip")
    toll_records: Mapped[list["ERDTollRecord"]] = relationship(back_populates="trip")


class ERDTruckSchedule(Base):
    __tablename__ = "erd_truck_schedule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    truck_id: Mapped[str] = mapped_column(ForeignKey("erd_trucks.plate_number"), nullable=False)
    trip_id: Mapped[int] = mapped_column(ForeignKey("erd_trips.id"), nullable=False)
    schedule_start: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    schedule_end: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    schedule_status: Mapped[str] = mapped_column(String(50), default="scheduled")

    truck: Mapped["ERDTruck"] = relationship(back_populates="schedules")
    trip: Mapped["ERDTrip"] = relationship(back_populates="schedules")


class ERDFuelRecord(Base):
    __tablename__ = "erd_fuel_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("erd_trips.id"), nullable=False)
    truck_id: Mapped[str] = mapped_column(ForeignKey("erd_trucks.plate_number"), nullable=False)
    liters_used: Mapped[float] = mapped_column(Float, default=0)
    fuel_cost: Mapped[float] = mapped_column(Float, default=0)
    recorded_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    trip: Mapped["ERDTrip"] = relationship(back_populates="fuel_records")


class ERDTollRecord(Base):
    __tablename__ = "erd_toll_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("erd_trips.id"), nullable=False)
    toll_amount: Mapped[float] = mapped_column(Float, default=0)

    trip: Mapped["ERDTrip"] = relationship(back_populates="toll_records")


class ERDMaintenanceReport(Base):
    __tablename__ = "erd_maintenance_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    truck_id: Mapped[str] = mapped_column(ForeignKey("erd_trucks.plate_number"), nullable=False)
    report_type: Mapped[str] = mapped_column(String(100), default="")
    description: Mapped[str] = mapped_column(String(500), default="")
    report_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    cost: Mapped[float] = mapped_column(Float, default=0)

    truck: Mapped["ERDTruck"] = relationship(back_populates="maintenance_reports")


class ERDPayment(Base):
    __tablename__ = "erd_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("erd_transactions.id"), nullable=False, unique=True)
    payment_method: Mapped[str] = mapped_column(String(100), default="")
    payment_status: Mapped[str] = mapped_column(String(50), default="pending")
    amount_paid: Mapped[float] = mapped_column(Float, default=0)
    payment_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    transaction: Mapped["ERDTransaction"] = relationship(back_populates="payment")


class ERDStock(Base):
    __tablename__ = "erd_stock"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("erd_transactions.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), default="")

    transaction: Mapped["ERDTransaction"] = relationship(back_populates="stocks")

